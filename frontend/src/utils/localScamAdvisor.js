/**
 * Local Autonomous Scam Advisor
 * Provides resilient, instant scam safety intelligence when third-party cloud LLMs
 * are unconfigured, expired, or temporarily rate-limited.
 */

export function generateLocalScamAdvice(userQuery, contextAnalysis = null) {
  const q = (userQuery || '').toLowerCase().trim();

  if (/fee|deposit|money|charge|pay|laptop|uniform|security|courier|2000|5000/.test(q)) {
    return {
      reply: `🚨 **RED FLAG WARNING: Legitimate Indian Employers NEVER Charge Fees!**\n\n` +
        `• **Zero Fee Policy:** Companies like TCS, Infosys, Wipro, Tata, and Indigo strictly follow a zero-fee hiring policy under NASSCOM & Indian labor guidelines.\n` +
        `• **Common Fee Excuses:** Security deposit for laptop, employee ID card processing, courier insurance, gate pass, or interview portal activation.\n` +
        `• **What to do:** Never pay via UPI or bank transfer. If you already sent money, immediately call the National Cyber Crime Helpline at **1930** within 2 hours (the "Golden Hour") to freeze the recipient account.`,
      disclaimer: 'CrediHire Autonomous Safety Advisory • 100% Offline Active Protection'
    };
  }

  if (/telegram|whatsapp|youtube|like|task|daily|rating|review|part.?time/.test(q)) {
    return {
      reply: `⚠️ **POPULAR SCAM ALERT: Telegram / WhatsApp "Like & Earn" Task Fraud**\n\n` +
        `• **The Hook:** You are offered ₹1,500–₹5,000 daily to like YouTube videos, rate Google Maps places, or review hotels.\n` +
        `• **The Trap:** They pay small ₹150–₹300 profits initially to build false trust, then demand a deposit (₹2,000–₹50,000) for "VIP High Commission Tasks" or "frozen withdrawal release".\n` +
        `• **Action Steps:** Immediately exit the Telegram group, block the WhatsApp sender (+234, +62, +84 numbers), and report the UPI ID to **cybercrime.gov.in**.`,
      disclaimer: 'CrediHire Autonomous Safety Advisory • 100% Offline Active Protection'
    };
  }

  if (/cybercrime|1930|police|report|fir|complaint|recover|freeze/.test(q)) {
    return {
      reply: `🛡️ **OFFICIAL CYBERCRIME REPORTING PROTOCOL (INDIA)**\n\n` +
        `1. **Immediate Call:** Dial **1930** (National Cyber Financial Fraud Helpline, 24x7).\n` +
        `2. **Online Portal:** File an FIR at **https://cybercrime.gov.in** under "Financial Fraud / Job Scam".\n` +
        `3. **Download Evidence:** Click **"Download Cybercrime PDF Dossier"** on CrediHire to attach our forensic report containing suspect UPI and verbatim evidence.\n` +
        `4. **Bank Alert:** Contact your bank's fraud desk to flag the UTR/transaction ID under Section 102 CrPC.`,
      disclaimer: 'CrediHire Autonomous Safety Advisory • 100% Offline Active Protection'
    };
  }

  if (/verify|check|recruiter|legitimate|authentic|real/.test(q)) {
    return {
      reply: `🔍 **HOW TO VERIFY AN AUTHENTIC RECRUITER IN 3 STEPS**\n\n` +
        `1. **Email Domain Check:** Authentic corporate recruiters use official business emails (e.g., \`name@tcs.com\`), NEVER \`@gmail.com\`, \`@yahoo.in\`, or misspelled domains like \`tcs-career.in\`.\n` +
        `2. **LinkedIn Cross-Check:** Search the recruiter's name and position on LinkedIn to confirm their active employment.\n` +
        `3. **Career Portal Listing:** Check the job requisition number directly on the official company career portal. If it's not listed there, it is not an authorized opening.`,
      disclaimer: 'CrediHire Autonomous Safety Advisory • 100% Offline Active Protection'
    };
  }

  return {
    reply: `💡 **CREDIHIRE SCAM PREVENTION GUIDANCE**\n\n` +
      `Job scams in India overwhelmingly share three specific traits:\n` +
      `1. Demanding an upfront security deposit, documentation fee, or training charge.\n` +
      `2. Conducting entire hiring processes exclusively over WhatsApp, Telegram, or SMS without video interviews.\n` +
      `3. Promising guaranteed high income (₹30,000–₹60,000/month) for trivial copy-paste or data entry tasks.\n\n` +
      `Paste any suspicious job message or letter into our **Job Offer Scanner** above for an instant deterministic risk assessment!`,
    disclaimer: 'CrediHire Autonomous Safety Advisory • 100% Offline Active Protection'
  };
}
