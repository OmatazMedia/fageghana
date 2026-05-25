type PaystackInit = {
  public_key: string;
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callback_url: string;
};

let scriptPromise: Promise<void> | null = null;

function loadPaystackScript() {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Paystack can only open in the browser"));
  if ((window as any).PaystackPop) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error("Could not load Paystack checkout. Please check your connection and try again."),
      );
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function openPaystackInline(init: PaystackInit, onClose?: () => void) {
  await loadPaystackScript();
  const PaystackPop = (window as any).PaystackPop;
  if (!PaystackPop?.setup) throw new Error("Paystack checkout is unavailable");
  const handler = PaystackPop.setup({
    key: init.public_key,
    email: init.email,
    amount: init.amount,
    currency: init.currency || "GHS",
    ref: init.reference,
    callback: (response: any) => {
      const url = new URL(init.callback_url, window.location.origin);
      url.searchParams.set("reference", response?.reference || init.reference);
      window.location.href = url.toString();
    },
    onClose,
  });
  handler.openIframe();
}
