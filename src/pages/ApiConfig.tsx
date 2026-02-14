import { useState, useEffect } from "react";
import { Key, Copy, Terminal, Info, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api } from "@/api/client";

interface ApiKey {
  id: string;
  name: string;
  prefix?: string;
  key?: string;
  last_used_at: string | null;
  created_at?: string;
  createdAt?: string;
}

export default function ApiConfig() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await api.apiKeys.list();
      setKeys(response.data || []);
    } catch (error) {
      toast.error("Gagal memuat API Key");
    } finally {
      setLoading(false);
    }
  };

  const deleteKey = async (_id: string) => {
    toast.error("Manajemen API Key dipindahkan ke ENV. Penghapusan via UI dinonaktifkan.");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Disalin ke papan klip");
  };

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
  const UPLOAD_ENDPOINT = `${API_URL}/external/upload`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API & Integrasi</h1>
          <p className="text-muted-foreground">Kunci API kini dikelola melalui ENV (n8n, cURL, dll)</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* API Keys List */}
        <Card className="glass-card md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Daftar API Key
            </CardTitle>
            <CardDescription>Kelola kunci akses untuk aplikasi pihak ketiga</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Memuat...</p>
            ) : keys.length === 0 ? (
              <div className="space-y-3">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Manajemen via ENV</AlertTitle>
                  <AlertDescription>
                    Set EXTERNAL_UPLOAD_API_KEY di environment server. Tidak ada pembuatan kunci melalui panel.
                  </AlertDescription>
                </Alert>
                <p className="text-muted-foreground text-center py-4">Daftar di bawah hanya menampilkan kunci lama (jika ada).</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Terakhir Digunakan</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="bg-muted px-2 py-1 rounded">
                            {key.prefix || (key.key ? (key.key.startsWith("sk_") ? key.key.slice(0,7) : key.key.slice(0,7)) : "-")}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(key.prefix || (key.key ? key.key.slice(0,7) : ""))}
                            disabled={!(key.prefix || key.key)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>
                        {(key.created_at || key.createdAt)
                          ? new Date(key.created_at || key.createdAt || "").toLocaleDateString("id-ID")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => deleteKey(key.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Documentation / Tutorial */}
        <Card className="glass-card md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Panduan Integrasi
            </CardTitle>
            <CardDescription>Cara menggunakan API dengan n8n atau HTTP Request</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="n8n" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                <TabsTrigger value="n8n">n8n Workflow</TabsTrigger>
                <TabsTrigger value="curl">cURL / HTTP</TabsTrigger>
              </TabsList>
              
              <TabsContent value="n8n" className="space-y-4 mt-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Fitur Smart Upload</AlertTitle>
                  <AlertDescription>
                    Endpoint ini otomatis memilih akun penyimpanan yang tersedia secara acak. Jika satu akun gagal atau terkena limit, sistem akan otomatis mencoba akun lain secepat kilat (Failover).
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Langkah-langkah di n8n:</h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Tambahkan node <strong>HTTP Request</strong>.</li>
                    <li>Set Method ke <strong>POST</strong>.</li>
                    <li>Masukkan URL: <code className="bg-muted px-1 rounded text-primary">{UPLOAD_ENDPOINT}</code></li>
                    <li>Di bagian <strong>Authentication</strong>, pilih <em>Header Auth</em> atau <em>Generic Credential Type</em>.</li>
                    <li>Tambahkan Header: <code>Authorization: Bearer YOUR_API_KEY</code></li>
                    <li>Di bagian <strong>Body Parameters</strong>, pilih <strong>Form-Data</strong>.</li>
                    <li>Tambahkan field bernama <code>file</code> dan pilih tipe <strong>Binary File</strong> (pilih input data dari node sebelumnya).</li>
                  </ol>
                </div>
              </TabsContent>

              <TabsContent value="curl" className="space-y-4 mt-4">
                <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm font-mono text-green-400">
{`curl -X POST "${UPLOAD_ENDPOINT}" \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -F "file=@/path/to/image.jpg"`}
                  </pre>
                </div>
                <p className="text-sm text-muted-foreground">
                  Response akan berisi URL file yang diunggah dan ID file.
                </p>
                <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm font-mono text-blue-300">
{`{
  "success": true,
  "data": {
    "url": "https://ik.imagekit.io/...",
    "file_id": "...",
    "name": "image.jpg"
  },
  "provider": "Akun ImageKit 1"
}`}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
