import { Award, ShieldCheck } from "lucide-react";
import { getCertificateByCode } from "@/server/kb/certificates";
import { PrintButton } from "./PrintButton";

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert = await getCertificateByCode(code);

  if (!cert) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center">
          <h1 className="text-xl font-semibold text-heading">
            Certificate not found
          </h1>
          <p className="mt-2 text-sm text-body">
            No certificate matches the code{" "}
            <span className="font-mono text-heading">{code}</span>.
          </p>
        </div>
      </div>
    );
  }

  const issued = cert.issuedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-canvas px-4 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        {/* Certificate */}
        <div className="relative overflow-hidden rounded-2xl border-4 border-double border-slate bg-surface p-10 text-center shadow-overlay print:border-slate print:shadow-none">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-indigo-soft text-indigo">
            <Award className="size-9" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            Certificate of Completion
          </div>
          <p className="mt-6 text-sm text-body">This certifies that</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-heading">
            {cert.recipientName}
          </h1>
          <p className="mt-6 text-sm text-body">has successfully completed</p>
          <h2 className="mt-2 text-xl font-semibold text-indigo">
            {cert.courseTitle}
          </h2>
          <p className="mt-6 text-sm text-body">on {issued}</p>

          <div className="mt-8 flex items-center justify-center gap-2 border-t border-border pt-6 text-xs text-muted">
            <ShieldCheck className="size-4 text-success" />
            Verified · Certificate ID{" "}
            <span className="font-mono text-body">{cert.code}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted">Issued by KnowledgeOS</div>
        </div>

        <div className="mt-6 flex justify-center print:hidden">
          <PrintButton />
        </div>
      </div>
    </div>
  );
}
