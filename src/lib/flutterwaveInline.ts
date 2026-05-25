type FlutterwaveInit = {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  email: string;
  name?: string;
  phone?: string;
  callback_url: string;
};

let scriptPromise: Promise<void> | null = null;

function loadFlutterwaveScript() {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Flutterwave can only open in the browser"));
  if ((window as any).FlutterwaveCheckout) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error(
          "Could not load Flutterwave checkout. Please check your connection and try again.",
        ),
      );
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function openFlutterwaveInline(init: FlutterwaveInit, onClose?: () => void) {
  await loadFlutterwaveScript();
  const FlutterwaveCheckout = (window as any).FlutterwaveCheckout;
  if (typeof FlutterwaveCheckout !== "function")
    throw new Error("Flutterwave checkout is unavailable");
  FlutterwaveCheckout({
    public_key: init.public_key,
    tx_ref: init.tx_ref,
    amount: init.amount,
    currency: init.currency || "GHS",
    payment_options: "card, mobilemoneyghana, ussd, banktransfer",
    customer: {
      email: init.email,
      name: init.name || init.email,
      phone_number: init.phone || "",
    },
    customizations: {
      title: "FAGE Ghana Membership",
      description: "Membership payment",
    },
    callback: (response: any) => {
      const ref = response?.tx_ref || init.tx_ref;
      const url = new URL(init.callback_url, window.location.origin);
      url.searchParams.set("reference", ref);
      url.searchParams.set("provider", "flutterwave");
      window.location.href = url.toString();
    },
    onclose: () => {
      if (onClose) onClose();
    },
  });
}
