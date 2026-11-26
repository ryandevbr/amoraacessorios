import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  money,
  resolveListingType,
  type Product,
  type ProductListingType,
} from "@/data/catalog";
import { runBatchWithAutoRetries } from "@/lib/batch-retry";
import { normalizeImageFile } from "@/lib/normalize-image";
import { analyzeProductWithAi } from "@/services/aiProductService";
import { optionLookupKey } from "@/services/catalogOptionsService";
import { deleteStoreImage, uploadStoreImage } from "@/services/storageService";

type QueueItemStatus = "queued" | "retrying" | "analyzing" | "uploading" | "done" | "failed";

interface BatchQueueItem {
  id: string;
  productId: string;
  file: File;
  originalName: string;
  previewUrl: string;
  status: QueueItemStatus;
  attempt: 1 | 2 | 3;
  uploadedImageUrl?: string;
  createdName?: string;
  error?: string;
}

export interface BatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableCategories: string[];
  availableMaterials: string[];
  onSaveProduct: (product: Product) => Promise<void>;
}

function matchOption(value: string, options: string[], fallback: string): string {
  const clean = value.trim();
  if (!clean) return fallback;
  const found = options.find((opt) => optionLookupKey(opt) === optionLookupKey(clean));
  return found ?? fallback;
}

export function BatchImportDialog({
  open,
  onOpenChange,
  availableCategories,
  availableMaterials,
  onSaveProduct,
}: BatchImportDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [listingType, setListingType] = useState<ProductListingType>("sale");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [material, setMaterial] = useState("");
  const [autoPublish, setAutoPublish] = useState(true);
  const [items, setItems] = useState<BatchQueueItem[]>([]);
  const [converting, setConverting] = useState(false);
  const [convertingProgress, setConvertingProgress] = useState({ current: 0, total: 0 });
  const [running, setRunning] = useState(false);
  const [countdownMessage, setCountdownMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<BatchQueueItem[]>(items);
  const runSessionRef = useRef(0);

  itemsRef.current = items;

  const cleanupItemsResources = (list: BatchQueueItem[]) => {
    for (const item of list) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.status !== "done" && item.uploadedImageUrl) {
        void deleteStoreImage(item.uploadedImageUrl);
      }
    }
  };

  useEffect(() => {
    return () => {
      runSessionRef.current += 1;
      cleanupItemsResources(itemsRef.current);
    };
  }, []);

  const resetModal = () => {
    runSessionRef.current += 1;
    cleanupItemsResources(itemsRef.current);
    setStep(1);
    setListingType("sale");
    setPrice("");
    setCategory("");
    setMaterial("");
    setAutoPublish(true);
    setItems([]);
    setConverting(false);
    setConvertingProgress({ current: 0, total: 0 });
    setRunning(false);
    setCountdownMessage(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (running) {
        toast.error("Aguarde o término do processamento em lote antes de fechar.");
        return;
      }
      resetModal();
    }
    onOpenChange(nextOpen);
  };

  const parsedPrice = Number(price.replace(",", "."));
  const priceValid = Number.isFinite(parsedPrice) && parsedPrice > 0;

  const handleSelectFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const rawFiles = Array.from(fileList);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setConverting(true);
    setConvertingProgress({ current: 0, total: rawFiles.length });

    let failedConversions = 0;
    const readyItems: BatchQueueItem[] = [];

    for (let index = 0; index < rawFiles.length; index += 1) {
      const rawFile = rawFiles[index];
      if (!rawFile) continue;
      setConvertingProgress({ current: index + 1, total: rawFiles.length });
      try {
        const normalized = await normalizeImageFile(rawFile);
        const previewUrl = URL.createObjectURL(normalized);
        readyItems.push({
          id: crypto.randomUUID(),
          productId: crypto.randomUUID(),
          file: normalized,
          originalName: rawFile.name,
          previewUrl,
          status: "queued",
          attempt: 1,
        });
      } catch {
        failedConversions += 1;
      }
    }

    if (readyItems.length > 0) {
      setItems((prev) => [...prev, ...readyItems]);
    }
    if (failedConversions > 0) {
      toast.error(
        failedConversions === 1
          ? "1 arquivo não pôde ser convertido e foi ignorado."
          : `${failedConversions} arquivos não puderam ser convertidos e foram ignorados.`,
      );
    }
    setConverting(false);
    setConvertingProgress({ current: 0, total: 0 });
  };

  const removeItem = (id: string) => {
    if (running) return;
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        if (target.status !== "done" && target.uploadedImageUrl) {
          void deleteStoreImage(target.uploadedImageUrl);
        }
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const updateItem = (
    id: string,
    patch: Partial<BatchQueueItem>,
    options?: { clearError?: boolean },
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const base = options?.clearError
          ? (({ error: _removed, ...rest }) => rest)(item)
          : item;
        return { ...base, ...patch };
      }),
    );
  };

  const processQueue = async (targetIds: string[]) => {
    const eligibleIds = targetIds.filter((id) => {
      const item = itemsRef.current.find((entry) => entry.id === id);
      return Boolean(item && item.status !== "done");
    });
    if (eligibleIds.length === 0 || !priceValid) return;

    const sessionId = ++runSessionRef.current;
    setStep(3);
    setRunning(true);
    setCountdownMessage(null);

    const eligibleSet = new Set(eligibleIds);
    setItems((prev) =>
      prev.map((item) => {
        if (!eligibleSet.has(item.id)) return item;
        const { error: _ignoredError, ...rest } = item;
        return { ...rest, status: "queued", attempt: 1 };
      }),
    );

    const result = await runBatchWithAutoRetries(eligibleIds, {
      isCancelled: () => sessionId !== runSessionRef.current,
      onCountdownTick: (message) => {
        if (sessionId === runSessionRef.current) {
          setCountdownMessage(message);
        }
      },
      onPrepareRetryRound: (failedIds, round) => {
        if (sessionId !== runSessionRef.current) return;
        const retrySet = new Set(failedIds);
        setItems((prev) =>
          prev.map((item) =>
            retrySet.has(item.id) && item.status !== "done"
              ? { ...item, status: "retrying", attempt: round.attempt }
              : item,
          ),
        );
      },
      processItem: async (itemId, attempt) => {
        const current = itemsRef.current.find((item) => item.id === itemId);
        if (!current) return false;
        if (current.status === "done") return true;

        try {
          updateItem(current.id, { status: "analyzing", attempt }, { clearError: true });

          const analysis = await analyzeProductWithAi({
            file: current.file,
            availableCategories:
              availableCategories.length > 0 ? availableCategories : ["Semijoias"],
            availableMaterials: availableMaterials.length > 0 ? availableMaterials : ["Semijoia"],
          });

          if (sessionId !== runSessionRef.current) return false;
          updateItem(current.id, { status: "uploading", attempt });

          let imageUrl = current.uploadedImageUrl;
          if (!imageUrl) {
            const uploaded = await uploadStoreImage(current.file, "products");
            imageUrl = uploaded.url;
            if (sessionId !== runSessionRef.current) {
              void deleteStoreImage(imageUrl);
              return false;
            }
            updateItem(current.id, { uploadedImageUrl: imageUrl });
          }

          const fallbackCategory = availableCategories[0] ?? "Semijoias";
          const fallbackMaterial = availableMaterials[0] ?? "Semijoia";
          const finalCategory = category
            ? category
            : matchOption(analysis.category, availableCategories, fallbackCategory);
          const finalMaterial = material
            ? material
            : matchOption(analysis.material, availableMaterials, fallbackMaterial);
          const finalListingType: ProductListingType =
            listingType === "rent"
              ? "rent"
              : resolveListingType("sale", finalCategory, finalMaterial);

          const product: Product = {
            id: current.productId,
            name: analysis.name.trim() || current.originalName.replace(/\.[^.]+$/, ""),
            sku: "",
            category: finalCategory,
            material: finalMaterial,
            listing_type: finalListingType,
            price: parsedPrice,
            sale_price: 0,
            is_on_sale: false,
            sale_label: "",
            image_url: imageUrl,
            description: analysis.description.trim(),
            active: autoPublish,
            featured: false,
            in_stock: true,
            characteristics: analysis.characteristics.map((c) => ({
              attribute: c.label,
              value: c.value,
            })),
          };

          await onSaveProduct(product);
          updateItem(
            current.id,
            { status: "done", attempt, createdName: product.name, uploadedImageUrl: imageUrl },
            { clearError: true },
          );
          return true;
        } catch (err) {
          updateItem(current.id, {
            status: "failed",
            attempt,
            error: err instanceof Error ? err.message : "Erro ao processar esta foto.",
          });
          return false;
        }
      },
    });

    if (sessionId !== runSessionRef.current || result.cancelled) return;
    setCountdownMessage(null);
    setRunning(false);

    const publishedNow = result.succeededIds.length;
    const failedNow = result.failedIds.length;

    if (failedNow === 0 && publishedNow > 0) {
      toast.success(
        publishedNow === 1
          ? "1 produto importado com sucesso!"
          : `${publishedNow} produtos importados com sucesso!`,
      );
    } else if (publishedNow > 0 && failedNow > 0) {
      toast.warning(
        `${publishedNow} importado(s) e ${failedNow} com falha após 3 tentativas. Você pode reprocessar manualmente.`,
      );
    } else if (failedNow > 0) {
      toast.error(
        "Não foi possível importar os itens selecionados após 3 tentativas. Tente reprocessar manualmente.",
      );
    }
  };

  const doneCount = items.filter((item) => item.status === "done").length;
  const failedItems = items.filter((item) => item.status === "failed");
  const completedForProgress = running ? doneCount : doneCount + failedItems.length;
  const progressPercent =
    items.length > 0 ? Math.round((completedForProgress / items.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-hidden flex flex-col w-[calc(100%-24px)] max-w-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (running) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (running) e.preventDefault();
        }}
      >
        <DialogTitle className="font-display text-3xl flex items-center gap-2">
          <Sparkles size={22} className="text-gold shrink-0" />
          Importar em Lote (IA)
        </DialogTitle>
        <DialogDescription>
          Envie várias fotos de uma vez e deixe a IA preencher nome, descrição e detalhes.
        </DialogDescription>

        <div className="grid grid-cols-3 gap-2 pt-2 pb-3 border-b text-[11px]">
          {[
            [1, "1. Configuração"],
            [2, "2. Fotos"],
            [3, "3. Processamento"],
          ].map(([num, label]) => {
            const activeStep = step === num;
            const completed = step > Number(num);
            return (
              <div
                key={num}
                className={`rounded-md px-2.5 py-2 text-center font-medium transition-colors ${
                  activeStep
                    ? "bg-primary text-primary-foreground"
                    : completed
                      ? "bg-secondary text-primary"
                      : "bg-muted/60 text-muted-foreground"
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>

        <div className="overflow-y-auto min-h-0 flex-1 space-y-5 pr-1 py-2">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <span className="block text-xs text-muted-foreground">Modalidade do Lote</span>
                <div
                  role="radiogroup"
                  aria-label="Modalidade do Lote"
                  className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/60 p-1"
                >
                  {(
                    [
                      ["sale", "Venda"],
                      ["rent", "Aluguel"],
                    ] as const
                  ).map(([mode, label]) => {
                    const selected = listingType === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setListingType(mode)}
                        className={`h-10 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          selected
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label>
                {listingType === "rent"
                  ? "Valor único do aluguel no lote (R$)"
                  : "Preço único do lote (R$)"}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ex.: 49.90"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </label>

              <div className="field-grid">
                <label>
                  Categoria padrão
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Deixar a IA identificar por foto</option>
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Material / Linha padrão
                  <select value={material} onChange={(e) => setMaterial(e.target.value)}>
                    <option value="">Deixar a IA identificar por foto</option>
                    {availableMaterials.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer rounded-lg border bg-secondary/40 p-3.5">
                <input
                  type="checkbox"
                  checked={autoPublish}
                  onChange={(e) => setAutoPublish(e.target.checked)}
                />
                Publicar automaticamente na vitrine após analisar
              </label>

              <Button
                type="button"
                className="w-full h-12"
                onClick={() => {
                  if (!priceValid) {
                    toast.error("Informe um preço válido maior que zero para o lote.");
                    return;
                  }
                  setStep(2);
                }}
              >
                Avançar para seleção de fotos
                <ArrowRight size={16} />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-lg border border-dashed border-gold/60 bg-secondary/40 p-5 text-center space-y-3">
                <ImagePlus size={28} className="mx-auto text-gold" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Selecione as fotos das peças (inclusive fotos do iPhone .HEIC/.HEIF)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Preço do lote: <strong>{money(parsedPrice)}</strong>
                    {listingType === "rent" ? " / aluguel" : ""} ·{" "}
                    {category || "Categoria pela IA"} · {material || "Material pela IA"}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.heic,.heif"
                  disabled={converting}
                  aria-label="Selecionar fotos para importação em lote"
                  onChange={(e) => void handleSelectFiles(e.target.files)}
                  className="bg-background"
                />
                {converting && (
                  <p className="inline-flex items-center gap-2 text-xs text-primary font-medium">
                    <Loader2 size={14} className="animate-spin" />
                    Convertendo e preparando fotos ({convertingProgress.current}/
                    {convertingProgress.total})...
                  </p>
                )}
              </div>

              {items.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {items.length} {items.length === 1 ? "foto pronta" : "fotos prontas"}
                    </span>
                    <button
                      type="button"
                      disabled={converting}
                      onClick={() => {
                        cleanupItemsResources(items);
                        setItems([]);
                      }}
                      className="text-destructive hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Limpar lista
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="relative rounded-lg border bg-background overflow-hidden"
                      >
                        <img
                          src={item.previewUrl}
                          alt={item.originalName}
                          className="w-full aspect-square object-cover bg-muted"
                        />
                        <button
                          type="button"
                          aria-label={`Remover ${item.originalName}`}
                          onClick={() => removeItem(item.id)}
                          className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-background/95 text-foreground border border-border shadow-xs hover:bg-destructive hover:text-destructive-foreground transition-colors cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                        <p className="px-2 py-1.5 text-[10px] text-muted-foreground truncate">
                          {item.originalName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={converting}
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={16} />
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="flex-1 h-12"
                  disabled={converting || items.length === 0}
                  onClick={() => void processQueue(items.map((item) => item.id))}
                >
                  <Sparkles size={16} />
                  Iniciar importação ({items.length} {items.length === 1 ? "foto" : "fotos"})
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-lg border bg-secondary/50 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-medium text-foreground">
                    {running
                      ? `Processando lote (${doneCount}/${items.length} publicada${doneCount === 1 ? "" : "s"})...`
                      : `Processamento concluído (${doneCount} publicado${doneCount === 1 ? "" : "s"}${
                          failedItems.length > 0 ? ` · ${failedItems.length} com falha` : ""
                        })`}
                  </span>
                  <span className="font-semibold text-primary shrink-0">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {countdownMessage && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-2 rounded-md border border-gold/50 bg-background/90 px-3 py-2 text-xs font-medium text-primary"
                  >
                    <Clock size={14} className="text-gold shrink-0 animate-pulse" />
                    <span>{countdownMessage}</span>
                  </div>
                )}
              </div>

              <div className="divide-y border rounded-lg overflow-hidden bg-background">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    <img
                      src={item.previewUrl}
                      alt={item.originalName}
                      className="w-12 h-12 rounded object-cover shrink-0 bg-muted"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {item.createdName || item.originalName}
                      </p>
                      {item.error && item.status === "failed" ? (
                        <p className="text-[11px] text-destructive mt-0.5 leading-4">
                          {item.error}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {item.originalName}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                        item.status === "done"
                          ? "bg-primary text-primary-foreground"
                          : item.status === "failed"
                            ? "bg-destructive/10 text-destructive border border-destructive/30"
                            : item.status === "analyzing" ||
                                item.status === "uploading" ||
                                item.status === "retrying"
                              ? "bg-secondary text-primary border border-gold/50"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {(item.status === "analyzing" || item.status === "uploading") && (
                        <Loader2 size={12} className="animate-spin" />
                      )}
                      {item.status === "retrying" && <Clock size={12} className="text-gold" />}
                      {item.status === "done" && <CheckCircle2 size={12} />}
                      {item.status === "failed" && <AlertCircle size={12} />}
                      {item.status === "queued" && "Na fila"}
                      {item.status === "retrying" && "Aguardando repescagem..."}
                      {item.status === "analyzing" &&
                        (item.attempt > 1 ? `Analisando (${item.attempt}/3)...` : "Analisando...")}
                      {item.status === "uploading" && "Enviando..."}
                      {item.status === "done" && (autoPublish ? "Publicado ✓" : "Salvo (oculto) ✓")}
                      {item.status === "failed" && "Falhou"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                {!running && failedItems.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={() => void processQueue(failedItems.map((item) => item.id))}
                  >
                    <RefreshCw size={15} />
                    Reprocessar falhas ({failedItems.length})
                  </Button>
                )}
                <Button
                  type="button"
                  className="flex-1 h-12"
                  disabled={running}
                  onClick={() => handleOpenChange(false)}
                >
                  {running ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Processando lote...
                    </>
                  ) : (
                    "Concluir"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
