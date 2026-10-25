export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <article className="container-site max-w-3xl py-16 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mb-1.5 [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-mist [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-mist">
      {children}
    </article>
  );
}
