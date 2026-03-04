"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  MapPin,
  Globe,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Baby,
  Monitor,
  Building2,
  Hash,
  Wifi,
  Search,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface PersonRow {
  moveId: number;
  userId: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  personalNumber: string | null;
  email: string | null;
  phone: string | null;
  fromCity: string | null;
  fromPostal: string | null;
  toCity: string | null;
  toPostal: string | null;
  moveDate: string | null;
  status: string;
  hasChildren: boolean;
  ipAddress: string | null;
  ipCity: string | null;
  ipRegion: string | null;
  ipCountry: string | null;
  fromMunicipality: string | null;
  fromCounty: string | null;
  toMunicipality: string | null;
  toCounty: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface DetailData {
  user: {
    id: number;
    name: string;
    firstName: string | null;
    lastName: string | null;
    personalNumber: string | null;
    email: string | null;
    phone: string | null;
    createdAt: string;
  };
  move: {
    id: number;
    fromStreet: string | null;
    fromPostal: string | null;
    fromCity: string | null;
    toStreet: string | null;
    toPostal: string | null;
    toCity: string | null;
    apartmentNumber: string | null;
    propertyDesignation: string | null;
    propertyOwner: string | null;
    moveDate: string | null;
    householdType: string | null;
    reason: string | null;
    hasChildren: boolean;
    status: string;
    ipAddress: string | null;
    ipCity: string | null;
    ipRegion: string | null;
    ipCountry: string | null;
    ipLatitude: string | null;
    ipLongitude: string | null;
    userAgent: string | null;
    fromMunicipality: string | null;
    fromCounty: string | null;
    fromLatitude: string | null;
    fromLongitude: string | null;
    toMunicipality: string | null;
    toCounty: string | null;
    toLatitude: string | null;
    toLongitude: string | null;
    createdAt: string;
  };
  enrichment: Record<string, unknown> | null;
  checklist: { id: number; title: string; completed: boolean; status: string }[];
  reminders: { id: number; kind: string; scheduledFor: string; emailTo: string | null; provider: string; subject: string | null }[];
}

const statusLabels: Record<string, string> = {
  draft: "Utkast",
  submitted: "Inskickad",
  confirmed: "Bekräftad",
  completed: "Klar",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-700",
  confirmed: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
};

const householdLabels: Record<string, string> = {
  myself: "Ensamstående",
  family: "Familj",
  partner: "Med partner",
  child: "Barn",
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm break-all">{value}</p>
      </div>
    </div>
  );
}

function EnrichmentSection({ data }: { data: Record<string, unknown> }) {
  const sections: { label: string; content: React.ReactNode }[] = [];

  if (data.fromPostalPap) {
    const p = data.fromPostalPap as Record<string, string>;
    sections.push({
      label: "PAP API – Från-adress",
      content: (
        <p className="text-sm">
          {p.city}{p.municipality ? `, ${p.municipality}` : ""}{p.county ? ` (${p.county})` : ""}
          {p.latitude ? ` · ${p.latitude}, ${p.longitude}` : ""}
        </p>
      ),
    });
  }

  if (data.toPostalPap) {
    const p = data.toPostalPap as Record<string, string>;
    sections.push({
      label: "PAP API – Till-adress",
      content: (
        <p className="text-sm">
          {p.city}{p.municipality ? `, ${p.municipality}` : ""}{p.county ? ` (${p.county})` : ""}
          {p.latitude ? ` · ${p.latitude}, ${p.longitude}` : ""}
        </p>
      ),
    });
  }

  if (data.fromNominatim) {
    const n = data.fromNominatim as Record<string, string>;
    sections.push({
      label: "Nominatim – Från-adress",
      content: (
        <div className="text-sm">
          <p className="truncate">{n.displayName}</p>
          {n.lat && <p className="text-muted-foreground">Koordinater: {n.lat}, {n.lon}</p>}
        </div>
      ),
    });
  }

  if (data.toNominatim) {
    const n = data.toNominatim as Record<string, string>;
    sections.push({
      label: "Nominatim – Till-adress",
      content: (
        <div className="text-sm">
          <p className="truncate">{n.displayName}</p>
          {n.lat && <p className="text-muted-foreground">Koordinater: {n.lat}, {n.lon}</p>}
        </div>
      ),
    });
  }

  if (data.ipGeo) {
    const g = data.ipGeo as Record<string, string>;
    sections.push({
      label: "IP-geolokalisering",
      content: (
        <p className="text-sm">
          {g.city}, {g.region}, {g.country} · {g.lat}, {g.lon}
        </p>
      ),
    });
  }

  if (data.eniro) {
    const eniro = data.eniro as Record<string, Record<string, string>[]>;
    for (const [term, results] of Object.entries(eniro)) {
      if (results.length > 0) {
        sections.push({
          label: `Eniro – "${term}" nära ny adress`,
          content: (
            <ul className="text-sm space-y-1">
              {results.map((r, i) => (
                <li key={i} className="text-muted-foreground">
                  {r.title}{r.address ? ` – ${r.address}` : ""}{r.city ? `, ${r.city}` : ""}
                  {r.phoneNumber ? ` (${r.phoneNumber})` : ""}
                </li>
              ))}
            </ul>
          ),
        });
      }
    }
  }

  if (data.scb) {
    const s = data.scb as Record<string, unknown>;
    sections.push({
      label: `SCB Befolkning (${s.year})`,
      content: (
        <p className="text-sm">
          {String(s.municipality)}: {Number(s.population).toLocaleString("sv-SE")} invånare
        </p>
      ),
    });
  }

  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen berikningsdata tillgänglig.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <div key={i}>
          <p className="text-xs font-semibold text-muted-foreground mb-1">{s.label}</p>
          {s.content}
        </div>
      ))}
    </div>
  );
}

export default function PersonerPage() {
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedMoveId, setSelectedMoveId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/personer")
      .then((r) => {
        if (!r.ok) throw new Error("Kunde inte hämta personer");
        return r.json();
      })
      .then((data) => setPersons(data.persons ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = useCallback(async (moveId: number) => {
    setSelectedMoveId(moveId);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const r = await fetch(`/api/admin/personer?id=${moveId}`);
      if (!r.ok) throw new Error("Kunde inte hämta detaljer");
      const data = await r.json();
      setDetail(data);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const filtered = persons.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.personalNumber?.includes(q) ||
      p.fromCity?.toLowerCase().includes(q) ||
      p.toCity?.toLowerCase().includes(q) ||
      p.ipAddress?.includes(q) ||
      p.ipCity?.toLowerCase().includes(q)
    );
  });

  if (error && !selectedMoveId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Personer</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedMoveId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedMoveId(null);
              setDetail(null);
              setDetailError(null);
            }}
          >
            <ArrowLeft className="size-4 mr-1" />
            Tillbaka
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Persondetaljer</h1>
        </div>

        {detailLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
                <CardContent><Skeleton className="h-32 w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : detail ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personuppgifter */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-4" />
                  Personuppgifter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={<Users className="size-4" />} label="Namn" value={detail.user.name} />
                {detail.user.firstName && (
                  <InfoRow icon={<Users className="size-4" />} label="Förnamn / Efternamn" value={`${detail.user.firstName} ${detail.user.lastName ?? ""}`} />
                )}
                <InfoRow icon={<Hash className="size-4" />} label="Personnummer" value={detail.user.personalNumber} />
                <InfoRow icon={<Mail className="size-4" />} label="E-post" value={detail.user.email} />
                <InfoRow icon={<Phone className="size-4" />} label="Telefon" value={detail.user.phone} />
                <InfoRow icon={<Calendar className="size-4" />} label="Registrerad" value={new Date(detail.user.createdAt).toLocaleString("sv-SE")} />
              </CardContent>
            </Card>

            {/* Flyttinformation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  Flytt
                </CardTitle>
                <CardDescription>
                  <Badge variant="secondary" className={statusColors[detail.move.status] ?? ""}>
                    {statusLabels[detail.move.status] ?? detail.move.status}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={<MapPin className="size-4" />} label="Från" value={
                  [detail.move.fromStreet, detail.move.fromPostal, detail.move.fromCity].filter(Boolean).join(", ") || null
                } />
                {detail.move.fromMunicipality && (
                  <InfoRow icon={<Building2 className="size-4" />} label="Kommun / Län (från)" value={
                    `${detail.move.fromMunicipality}${detail.move.fromCounty ? `, ${detail.move.fromCounty}` : ""}`
                  } />
                )}
                {detail.move.fromLatitude && (
                  <InfoRow icon={<Globe className="size-4" />} label="Koordinater (från)" value={`${detail.move.fromLatitude}, ${detail.move.fromLongitude}`} />
                )}
                <Separator className="my-2" />
                <InfoRow icon={<MapPin className="size-4" />} label="Till" value={
                  [detail.move.toStreet, detail.move.toPostal, detail.move.toCity].filter(Boolean).join(", ") || null
                } />
                {detail.move.toMunicipality && (
                  <InfoRow icon={<Building2 className="size-4" />} label="Kommun / Län (till)" value={
                    `${detail.move.toMunicipality}${detail.move.toCounty ? `, ${detail.move.toCounty}` : ""}`
                  } />
                )}
                {detail.move.toLatitude && (
                  <InfoRow icon={<Globe className="size-4" />} label="Koordinater (till)" value={`${detail.move.toLatitude}, ${detail.move.toLongitude}`} />
                )}
                <Separator className="my-2" />
                <InfoRow icon={<Calendar className="size-4" />} label="Flyttdatum" value={detail.move.moveDate ? new Date(detail.move.moveDate).toLocaleDateString("sv-SE") : null} />
                <InfoRow icon={<Users className="size-4" />} label="Hushållstyp" value={detail.move.householdType ? (householdLabels[detail.move.householdType] ?? detail.move.householdType) : null} />
                <InfoRow icon={<Baby className="size-4" />} label="Har barn som flyttar" value={detail.move.hasChildren ? "Ja" : "Nej"} />
                {detail.move.apartmentNumber && (
                  <InfoRow icon={<Hash className="size-4" />} label="Lägenhetsnummer" value={detail.move.apartmentNumber} />
                )}
                {detail.move.propertyDesignation && (
                  <InfoRow icon={<Building2 className="size-4" />} label="Fastighetsbeteckning" value={detail.move.propertyDesignation} />
                )}
                {detail.move.propertyOwner && (
                  <InfoRow icon={<Building2 className="size-4" />} label="Fastighetsägare" value={detail.move.propertyOwner} />
                )}
                {detail.move.reason && (
                  <InfoRow icon={<AlertCircle className="size-4" />} label="Anledning" value={detail.move.reason} />
                )}
              </CardContent>
            </Card>

            {/* IP & enhet */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="size-4" />
                  IP-adress & Enhet
                </CardTitle>
                <CardDescription>Uppgifter om var registreringen gjordes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={<Globe className="size-4" />} label="IP-adress" value={detail.move.ipAddress} />
                {detail.move.ipCity && (
                  <InfoRow icon={<MapPin className="size-4" />} label="IP-plats" value={
                    `${detail.move.ipCity}, ${detail.move.ipRegion}, ${detail.move.ipCountry}`
                  } />
                )}
                {detail.move.ipLatitude && (
                  <InfoRow icon={<Globe className="size-4" />} label="IP-koordinater" value={`${detail.move.ipLatitude}, ${detail.move.ipLongitude}`} />
                )}
                <InfoRow icon={<Monitor className="size-4" />} label="User-Agent" value={detail.move.userAgent} />
              </CardContent>
            </Card>

            {/* API-berikningsdata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="size-4" />
                  API-berikning
                </CardTitle>
                <CardDescription>Data från PAP, Nominatim, Eniro, SCB, IP-geo</CardDescription>
              </CardHeader>
              <CardContent>
                {detail.enrichment ? (
                  <EnrichmentSection data={detail.enrichment} />
                ) : (
                  <p className="text-sm text-muted-foreground">Ingen berikningsdata har sparats ännu.</p>
                )}
              </CardContent>
            </Card>

            {/* Checklista */}
            {detail.checklist.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Checklista ({detail.checklist.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {detail.checklist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm rounded-lg border p-2">
                        <span className={item.completed ? "line-through text-muted-foreground" : ""}>{item.title}</span>
                        <Badge variant="secondary" className="text-xs">
                          {item.status === "done" ? "Klar" : item.status === "in_progress" ? "Pågår" : "Att göra"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Påminnelser */}
            {detail.reminders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Påminnelser ({detail.reminders.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {detail.reminders.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm rounded-lg border p-2">
                        <div>
                          <p className="font-medium">{r.subject ?? r.kind}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.scheduledFor} · {r.emailTo} · {r.provider}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : detailError ? (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{detailError}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Ingen detaljdata tillgänglig.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Personer</h1>
        <p className="text-muted-foreground">
          Alla registrerade personer och deras uppgifter
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sök namn, e-post, telefon, personnummer, ort, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline">{filtered.length} personer</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {persons.length === 0 ? "Inga registrerade personer ännu." : "Inga träffar för sökningen."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>E-post / Telefon</TableHead>
                  <TableHead>Flytt</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP-plats</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.moveId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(p.moveId)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        {p.personalNumber && (
                          <p className="text-xs text-muted-foreground">{p.personalNumber}</p>
                        )}
                        {p.hasChildren && (
                          <Badge variant="outline" className="text-xs mt-0.5">
                            <Baby className="size-3 mr-1" />
                            Barn
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {p.email && <p>{p.email}</p>}
                        {p.phone && <p className="text-muted-foreground">{p.phone}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{p.fromCity ?? "–"} → {p.toCity ?? "–"}</p>
                        {p.toMunicipality && (
                          <p className="text-xs text-muted-foreground">{p.toMunicipality}{p.toCounty ? `, ${p.toCounty}` : ""}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {p.moveDate ? new Date(p.moveDate).toLocaleDateString("sv-SE") : "–"}
                        <p className="text-xs text-muted-foreground">
                          Reg: {new Date(p.createdAt).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[p.status] ?? ""}>
                        {statusLabels[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {p.ipCity ? (
                          <div>
                            <p>{p.ipCity}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.ipRegion}{p.ipCountry ? `, ${p.ipCountry}` : ""}
                            </p>
                          </div>
                        ) : p.ipAddress ? (
                          <p className="text-xs text-muted-foreground">{p.ipAddress}</p>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
