import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const BLOG_SLUG_REDIRECTS: Record<string, string> = {
  "getting-started-with-nemoclaw-on-papayaclaw": "getting-started-with-nemoclaw",
  "como-empezar-con-nemoclaw-en-papayaclaw": "getting-started-with-nemoclaw",
  "how-to-setup-whatsapp-channel-on-papayaclaw": "whatsapp-channel-setup",
  "como-configurar-el-canal-de-whatsapp-en-papayaclaw": "whatsapp-channel-setup",
  "introduccion-a-openclaw": "introduction-to-openclaw",
};

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["ssh2"],
  async redirects() {
    return Object.entries(BLOG_SLUG_REDIRECTS).flatMap(([from, to]) => [
      { source: `/blog/${from}`, destination: `/blog/${to}`, permanent: true },
      { source: `/es/blog/${from}`, destination: `/es/blog/${to}`, permanent: true },
    ]);
  },
};

export default withNextIntl(nextConfig);
