const INDEXNOW_KEY = "1100aa3e028c45aaa52f03f3423f3af6";

export function getIndexNowConfig() {
  const host =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ||
    "papayaclaw.com";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://papayaclaw.com";

  return { host, baseUrl, key: INDEXNOW_KEY };
}

export async function submitToIndexNow(urls: string[]): Promise<{
  success: boolean;
  status: number;
  message: string;
}> {
  if (urls.length === 0) {
    return { success: true, status: 200, message: "No URLs to submit" };
  }

  const { host, baseUrl, key } = getIndexNowConfig();

  const body = {
    host,
    key,
    keyLocation: `${baseUrl}/${key}.txt`,
    urlList: urls,
  };

  const response = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  const success = response.status === 200 || response.status === 202;

  return {
    success,
    status: response.status,
    message: success
      ? `Submitted ${urls.length} URL(s) successfully`
      : `IndexNow returned status ${response.status}`,
  };
}
