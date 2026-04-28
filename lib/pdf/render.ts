import puppeteer, { Browser, PaperFormat } from "puppeteer-core";

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

const LOCAL_CHROME_PATHS: Record<string, string> = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
};

export interface PdfRenderOptions {
  format?: PaperFormat;
  margin?: { top: string; right: string; bottom: string; left: string };
  headerHTML?: string;
  footerHTML?: string;
  displayHeaderFooter?: boolean;
}

export async function htmlToPdf(
  html: string,
  opts: PdfRenderOptions = {}
): Promise<Buffer> {
  const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;

  let browser: Browser;
  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    });
  } else {
    const localPath = LOCAL_CHROME_PATHS[process.platform];
    browser = await puppeteer.launch({
      executablePath: localPath,
      defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
    });
  }

  try {
    const page = await browser.newPage();
    await page.emulateMediaType("screen");
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    const pdf = await page.pdf({
      format: opts.format ?? "A4",
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: opts.displayHeaderFooter ?? true,
      headerTemplate: opts.headerHTML ?? "<span></span>",
      footerTemplate: opts.footerHTML ?? "<span></span>",
      margin: opts.margin ?? {
        top: "16mm",
        right: "14mm",
        bottom: "18mm",
        left: "14mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
