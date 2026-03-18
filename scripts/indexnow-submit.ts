/**
 * Postbuild script: reads the generated sitemap and submits all URLs to IndexNow.
 * Runs automatically after `next build` via the `postbuild` npm script.
 *
 * Requires NEXT_PUBLIC_APP_URL to be set (skips in dev/localhost).
 */

const INDEXNOW_KEY = "1100aa3e028c45aaa52f03f3423f3af6";

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl || baseUrl.includes("localhost")) {
    console.log("[IndexNow] Skipping — no production URL configured.");
    return;
  }

  const host = baseUrl.replace(/^https?:\/\//, "");

  // Fetch the generated sitemap
  console.log(`[IndexNow] Fetching sitemap from ${baseUrl}/sitemap.xml ...`);

  let sitemapXml: string;
  try {
    const res = await fetch(`${baseUrl}/sitemap.xml`);
    sitemapXml = await res.text();
  } catch {
    console.log(
      "[IndexNow] Could not fetch sitemap (site may not be deployed yet). Falling back to static URLs."
    );
    sitemapXml = "";
  }

  let urls: string[];

  if (sitemapXml) {
    // Extract all <loc> URLs from the sitemap XML
    urls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  } else {
    // Fallback: submit known static routes
    urls = [
      `${baseUrl}/`,
      `${baseUrl}/pricing`,
      `${baseUrl}/blog`,
      `${baseUrl}/es`,
      `${baseUrl}/es/pricing`,
      `${baseUrl}/es/blog`,
    ];
  }

  if (urls.length === 0) {
    console.log("[IndexNow] No URLs found to submit.");
    return;
  }

  console.log(`[IndexNow] Submitting ${urls.length} URL(s) ...`);

  const body = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${baseUrl}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  const response = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  if (response.status === 200 || response.status === 202) {
    console.log(
      `[IndexNow] Success (${response.status}) — ${urls.length} URL(s) submitted to Bing, Yandex, and other IndexNow engines.`
    );
  } else {
    console.error(
      `[IndexNow] Failed with status ${response.status}: ${await response.text()}`
    );
    process.exit(1);
  }
}

main();
