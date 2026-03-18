import { NextRequest, NextResponse } from "next/server";
import { submitToIndexNow, getIndexNowConfig } from "@/lib/indexnow";
import { getBlogPosts } from "@/lib/mdx";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.INDEXNOW_API_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { baseUrl } = getIndexNowConfig();

  let urls: string[];

  if (body?.urls && Array.isArray(body.urls)) {
    urls = body.urls;
  } else {
    // Submit all public pages by default
    const staticUrls = [
      `${baseUrl}/`,
      `${baseUrl}/pricing`,
      `${baseUrl}/blog`,
      `${baseUrl}/es`,
      `${baseUrl}/es/pricing`,
      `${baseUrl}/es/blog`,
    ];

    const blogPosts = await getBlogPosts();
    const blogUrls = blogPosts.flatMap((post) => [
      `${baseUrl}/blog/${post.slug}`,
      `${baseUrl}/es/blog/${post.slug}`,
    ]);

    urls = [...staticUrls, ...blogUrls];
  }

  const result = await submitToIndexNow(urls);

  return NextResponse.json(result, {
    status: result.success ? 200 : 502,
  });
}
