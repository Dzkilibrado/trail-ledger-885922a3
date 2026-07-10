import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BR_UFS, fetchMunicipiosByUF, formatLocation, normalizeSearch, parseLocation } from "@/lib/br-locations";
import { ChevronDown, MapPin, Search, X } from "lucide-react";

const OTHER = "__other__";

/**
 * Seletor oficial de Estado/Cidade do TrailBook.
 * Padrão UX: Seleção → Autocomplete → Texto livre (apenas "Outros"). Mobile-first (bottom sheet + busca).
 * Valor persistido: "Cidade / UF" (ou o texto livre quando UF = Outros).
 */
export function LocationPicker({
  value,
  onChange,
  label = "Local",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const parsed = parseLocation(value);
  const parsedIsOther = !!parsed.city && !parsed.uf;
  const [uf, setUf] = useState<string>(parsed.uf || (parsedIsOther ? OTHER : ""));
  const [city, setCity] = useState<string>(parsed.city || "");
  const [cityIsOther, setCityIsOther] = useState<boolean>(false);
  const [freeText, setFreeText] = useState<string>(parsedIsOther ? parsed.city : "");

  // Sheets
  const [ufOpen, setUfOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [ufSearch, setUfSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);

  useEffect(() => {
    if (!uf || uf === OTHER) { setCities([]); return; }
    let cancelled = false;
    setLoadingCities(true); setCityError(null);
    fetchMunicipiosByUF(uf)
      .then((list) => { if (!cancelled) setCities(list); })
      .catch(() => { if (!cancelled) setCityError("Não foi possível carregar cidades. Selecione 'Outros' para digitar."); })
      .finally(() => { if (!cancelled) setLoadingCities(false); });
    return () => { cancelled = true; };
  }, [uf]);

  // Emit changes upstream
  useEffect(() => {
    if (uf === OTHER) { onChange(freeText.trim()); return; }
    if (cityIsOther) { onChange(formatLocation(freeText.trim(), uf)); return; }
    onChange(formatLocation(city, uf));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uf, city, cityIsOther, freeText]);

  const ufList = useMemo(() => {
    const q = normalizeSearch(ufSearch);
    const base = BR_UFS.filter((u) => !q || normalizeSearch(u.nome).includes(q) || normalizeSearch(u.sigla).includes(q));
    return base;
  }, [ufSearch]);

  const cityList = useMemo(() => {
    const q = normalizeSearch(citySearch);
    if (!q) return cities.slice(0, 200);
    return cities.filter((c) => normalizeSearch(c).includes(q)).slice(0, 200);
  }, [cities, citySearch]);

  const ufLabel = uf === OTHER ? "Outros" : (BR_UFS.find((u) => u.sigla === uf)?.nome ?? "Selecionar estado");
  const cityLabel = cityIsOther ? "Outros" : (city || "Selecionar cidade");

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {/* UF trigger */}
        <Sheet open={ufOpen} onOpenChange={setUfOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-left disabled:opacity-50"
            >
              <span className={uf ? "" : "text-muted-foreground"}>{uf ? ufLabel : "Estado (UF) *"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] p-0">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Estado</SheetTitle>
            </SheetHeader>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus placeholder="Buscar estado…" className="pl-9" value={ufSearch} onChange={(e) => setUfSearch(e.target.value)} />
              </div>
            </div>
            <ul className="max-h-[55vh] overflow-y-auto">
              {ufList.map((u) => (
                <li key={u.sigla}>
                  <button
                    type="button"
                    onClick={() => { setUf(u.sigla); setCity(""); setCityIsOther(false); setFreeText(""); setUfSearch(""); setUfOpen(false); }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted ${uf === u.sigla ? "bg-muted" : ""}`}
                  >
                    <span>{u.nome}</span>
                    <span className="text-xs text-muted-foreground">{u.sigla}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => { setUf(OTHER); setCity(""); setCityIsOther(false); setFreeText(""); setUfOpen(false); }}
                  className={`flex w-full items-center justify-between border-t border-border px-4 py-3 text-left text-sm hover:bg-muted ${uf === OTHER ? "bg-muted" : ""}`}
                >
                  <span>Outros (fora do Brasil / não listado)</span>
                </button>
              </li>
            </ul>
          </SheetContent>
        </Sheet>

        {/* City trigger */}
        {uf !== OTHER && (
          <Sheet open={cityOpen} onOpenChange={(o) => { if (o && !uf) return; setCityOpen(o); }}>
            <SheetTrigger asChild>
              <button
                type="button"
                disabled={disabled || !uf}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-left disabled:opacity-50"
              >
                <span className={city || cityIsOther ? "" : "text-muted-foreground"}>{uf ? cityLabel : "Selecione o estado primeiro"}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] p-0">
              <SheetHeader className="border-b border-border p-4">
                <SheetTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Cidade — {uf}</SheetTitle>
              </SheetHeader>
              <div className="border-b border-border p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input autoFocus placeholder="Buscar cidade…" className="pl-9" value={citySearch} onChange={(e) => setCitySearch(e.target.value)} />
                </div>
              </div>
              {loadingCities && <div className="p-6 text-center text-sm text-muted-foreground">Carregando cidades…</div>}
              {cityError && <div className="p-4 text-sm text-destructive">{cityError}</div>}
              {!loadingCities && !cityError && (
                <ul className="max-h-[55vh] overflow-y-auto">
                  {cityList.map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        onClick={() => { setCity(c); setCityIsOther(false); setFreeText(""); setCitySearch(""); setCityOpen(false); }}
                        className={`flex w-full items-center px-4 py-3 text-left text-sm hover:bg-muted ${city === c ? "bg-muted" : ""}`}
                      >
                        {c}
                      </button>
                    </li>
                  ))}
                  {cityList.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma cidade encontrada.</li>}
                  <li>
                    <button
                      type="button"
                      onClick={() => { setCityIsOther(true); setCity(""); setCityOpen(false); }}
                      className={`flex w-full items-center border-t border-border px-4 py-3 text-left text-sm hover:bg-muted ${cityIsOther ? "bg-muted" : ""}`}
                    >
                      Outros (digitar manualmente)
                    </button>
                  </li>
                </ul>
              )}
            </SheetContent>
          </Sheet>
        )}
      </div>

      {(uf === OTHER || cityIsOther) && (
        <div className="space-y-1.5">
          <Label htmlFor="loc-free" className="text-xs text-muted-foreground">
            {uf === OTHER ? "Local (texto livre)" : `Cidade em ${uf} (texto livre)`}
          </Label>
          <Input
            id="loc-free"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={uf === OTHER ? "Ex.: Assunção, Paraguai" : "Ex.: Distrito de…"}
          />
        </div>
      )}

      {value && (
        <button
          type="button"
          onClick={() => { setUf(""); setCity(""); setCityIsOther(false); setFreeText(""); }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Limpar local
        </button>
      )}
    </div>
  );
}
