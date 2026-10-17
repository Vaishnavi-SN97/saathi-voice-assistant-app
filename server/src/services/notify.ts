import twilio from "twilio";
import { audit } from "../audit.js";
import type { Env } from "../env.js";
import { toLang, type Lang } from "../form.js";
import type { MediaStore } from "../mediaStore.js";
import type { Store } from "../store.js";

export type NotifyEvent = "needs_fix" | "ready_for_review" | "approved" | "sent_back" | "signed";
export interface WhatsAppMessage { from: string; to: string; body: string; mediaUrl?: string[] }
export type Sender = (msg: WhatsAppMessage) => Promise<void>;
export interface NotifyResult { sent: boolean; reason?: string }

// hi / kn wording needs a native-speaker check.
const TEXT: Record<Exclude<NotifyEvent, "sent_back">, Record<Lang, string>> = {
  needs_fix: {
    en: "Saathi: some of your documents need a fix. Please open the app to see what to correct.",
    hi: "साथी: आपके कुछ दस्तावेज़ों में सुधार करना है। क्या ठीक करना है, यह देखने के लिए ऐप खोलें।",
    kn: "ಸಾಥಿ: ನಿಮ್ಮ ಕೆಲವು ದಾಖಲೆಗಳಲ್ಲಿ ತಿದ್ದುಪಡಿ ಬೇಕಾಗಿದೆ. ಏನು ಸರಿಪಡಿಸಬೇಕೆಂದು ನೋಡಲು ಆಪ್ ತೆರೆಯಿರಿ.",
  },
  ready_for_review: {
    en: "Saathi: your application has been sent to the bank for review.",
    hi: "साथी: आपका आवेदन समीक्षा के लिए बैंक को भेज दिया गया है।",
    kn: "ಸಾಥಿ: ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಪರಿಶೀಲನೆಗಾಗಿ ಬ್ಯಾಂಕ್‌ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.",
  },
  approved: {
    en: "Saathi: your application is approved! Visit the branch and show the attached QR code to sign.",
    hi: "साथी: आपका आवेदन मंज़ूर हो गया है! शाखा में जाएं और हस्ताक्षर के लिए साथ भेजा गया क्यूआर कोड दिखाएं।",
    kn: "ಸಾಥಿ: ನಿಮ್ಮ ಅರ್ಜಿ ಅನುಮೋದನೆಯಾಗಿದೆ! ಶಾಖೆಗೆ ಹೋಗಿ ಸಹಿ ಮಾಡಲು ಲಗತ್ತಿಸಿದ ಕ್ಯೂಆರ್ ಕೋಡ್ ತೋರಿಸಿ.",
  },
  signed: {
    en: "Saathi: your account application is signed and complete. Thank you!",
    hi: "साथी: आपके खाते का आवेदन हस्ताक्षरित और पूरा हो गया है। धन्यवाद!",
    kn: "ಸಾಥಿ: ನಿಮ್ಮ ಖಾತೆ ಅರ್ಜಿ ಸಹಿ ಮಾಡಲಾಗಿದೆ ಮತ್ತು ಪೂರ್ಣಗೊಂಡಿದೆ. ಧನ್ಯವಾದಗಳು!",
  },
};
const SENT_BACK_PREFIX: Record<Lang, string> = {
  en: "Saathi: the bank needs a change to your application: ",
  hi: "साथी: बैंक को आपके आवेदन में बदलाव चाहिए: ",
  kn: "ಸಾಥಿ: ನಿಮ್ಮ ಅರ್ಜಿಯಲ್ಲಿ ಬ್ಯಾಂಕ್‌ಗೆ ಬದಲಾವಣೆ ಬೇಕಾಗಿದೆ: ",
};

export const messageText = (event: NotifyEvent, lang: Lang, note?: string) =>
  event === "sent_back" ? SENT_BACK_PREFIX[lang] + (note ?? "") : TEXT[event][lang];

const twilioSender = (env: Env): Sender | null => {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) return null;
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return async (m) => { await client.messages.create(m); };
};

export interface NotifyExtra {
  /** Message text override, e.g. the translated bank note for sent_back. */
  note?: string;
  /** Media attached by URL (voice note mp3 or QR png); must be stored in the media store. */
  mediaId?: string;
}

/**
 * WhatsApp via Twilio, direct. SPEC: only with notify consent; NOTIFY_MODE=off disables; media goes as
 * mediaUrl = PUBLIC_API_URL/media/:id?token=... Never throws: a failed notification must not break the journey.
 * Audit records the outcome without the phone number or message text.
 */
export class Notifier {
  private send: Sender | null;
  constructor(private env: Env, private store: Store, private media: MediaStore, sender?: Sender) {
    this.send = sender ?? twilioSender(env);
  }

  async notify(appId: string, app: Record<string, any>, event: NotifyEvent, extra: NotifyExtra = {}): Promise<NotifyResult> {
    const skip = async (reason: string): Promise<NotifyResult> => {
      await audit(this.store, "system", "notify.skipped", appId, { event, reason });
      return { sent: false, reason };
    };
    if (this.env.NOTIFY_MODE === "off") return skip("mode_off");
    if (app.notify?.consent !== true) return skip("no_consent");
    const phone = String(app.notify?.phone ?? "");
    if (!/^[6-9]\d{9}$/.test(phone)) return skip("no_phone");
    if (!this.send) return skip("no_credentials");

    const lang = toLang(app.language) ?? "en";
    const msg: WhatsAppMessage = {
      from: `whatsapp:${this.env.TWILIO_WHATSAPP_FROM!.replace(/^whatsapp:/, "")}`,
      to: `whatsapp:+91${phone}`,
      body: messageText(event, lang, extra.note),
      ...(extra.mediaId ? { mediaUrl: [this.env.PUBLIC_API_URL.replace(/\/$/, "") + this.media.url(extra.mediaId)] } : {}),
    };
    try {
      await this.send(msg);
      await audit(this.store, "system", "notify.sent", appId, { event, media: !!extra.mediaId });
      return { sent: true };
    } catch (e) {
      console.error("WhatsApp send failed:", (e as Error).message);
      await audit(this.store, "system", "notify.failed", appId, { event });
      return { sent: false, reason: "send_failed" };
    }
  }
}
