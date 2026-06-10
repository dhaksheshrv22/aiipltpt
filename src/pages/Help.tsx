import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Printer } from "lucide-react";
import Seo from "@/components/Seo";

type Step = [string, string];
type Section = { en: string; hi: string; steps: Step[] };

const SECTIONS: Section[] = [
  {
    en: "1. Getting Started",
    hi: "१. शुरुआत",
    steps: [
      ["Open the app in your browser. Use a Chrome-based browser on a tablet or PC for best results.",
       "ऐप को ब्राउज़र में खोलें। टैबलेट या पीसी पर Chrome ब्राउज़र सबसे अच्छा रहता है।"],
      ["Log in with your operator email and password on the Login page.",
       "लॉगिन पेज पर अपनी ऑपरेटर ईमेल और पासवर्ड डालकर लॉगिन करें।"],
      ["After login you will see the Dashboard with today's active vehicles, exits, and revenue.",
       "लॉगिन के बाद डैशबोर्ड दिखेगा जिसमें आज की सक्रिय गाड़ियाँ, निकास और कमाई दिखती है।"],
      ["Use the sidebar (left on desktop, bottom on mobile) to move between pages: Dashboard, Entry, Active, Stock, Monthly Passes, History, Reports, Settings, Help.",
       "बाएँ साइडबार (मोबाइल पर नीचे) से पेज बदलें: डैशबोर्ड, एंट्री, सक्रिय, स्टॉक, मासिक पास, इतिहास, रिपोर्ट, सेटिंग्स, सहायता।"],
    ],
  },
  {
    en: "2. Vehicle Entry",
    hi: "२. गाड़ी एंट्री",
    steps: [
      ["Open the 'Entry' page from the sidebar.",
       "साइडबार से 'एंट्री' पेज खोलें।"],
      ["Type the vehicle number in CAPITALS (e.g. MH12AB1234). After 2 letters, if this vehicle has parked before, a dropdown appears with its previous record.",
       "गाड़ी नंबर बड़े अक्षरों में टाइप करें (जैसे MH12AB1234)। 2 अक्षर के बाद, अगर गाड़ी पहले आ चुकी है तो ड्रॉपडाउन में पुराना रिकॉर्ड दिखेगा।"],
      ["Tap the dropdown suggestion — driver mobile and wheel count auto-fill from the last visit. You can still edit them if changed.",
       "ड्रॉपडाउन सुझाव पर टैप करें — पिछली विज़िट से ड्राइवर मोबाइल और पहियों की संख्या अपने आप भर जाएगी। ज़रूरत हो तो बदल भी सकते हैं।"],
      ["Confirm the wheel count (6/10/12/14/16/18+) — this decides the daily rate, shown live next to the field.",
       "पहियों की संख्या (6/10/12/14/16/18+) सही करें — यह दैनिक दर तय करती है, साथ में दिखती है।"],
      ["If the driver is paying day 1 in advance, turn ON the 'Advance Paid' switch. The card turns green and an advance payment is saved.",
       "अगर ड्राइवर पहले दिन का भुगतान अग्रिम कर रहा है, तो 'Advance Paid' स्विच ऑन करें। कार्ड हरा हो जाएगा और अग्रिम भुगतान दर्ज होगा।"],
      ["Tap 'Generate Entry Token'. A token popup opens with the entry receipt, barcode, and print options.",
       "'Generate Entry Token' दबाएँ। टोकन पॉपअप में एंट्री रसीद, बारकोड और प्रिंट विकल्प दिखेंगे।"],
      ["Print using 'Browser Print' (any printer) or 'Bluetooth Print' (paired thermal printer). Hand the slip to the driver.",
       "'Browser Print' या 'Bluetooth Print' से प्रिंट करें। पर्ची ड्राइवर को दें।"],
    ],
  },
  {
    en: "3. Active Vehicles",
    hi: "३. सक्रिय गाड़ियाँ",
    steps: [
      ["Open 'Active Vehicles' to see every truck currently inside the terminal.",
       "अभी अंदर खड़ी हर गाड़ी देखने के लिए 'Active Vehicles' खोलें।"],
      ["Use the search box for vehicle number or driver mobile. Use filter tabs: All, Temp Out, Overstay, Advance, Due.",
       "सर्च बॉक्स में गाड़ी नंबर या मोबाइल डालें। टैब से फ़िल्टर करें: All, Temp Out, Overstay, Advance, Due।"],
      ["Card colour — Green: advance · Yellow: temp out / due · Red: overstay or over credit limit · Blue: normal.",
       "कार्ड के रंग — हरा: एडवांस · पीला: अस्थायी बाहर / बकाया · लाल: ओवरस्टे या लिमिट पार · नीला: सामान्य।"],
      ["Each card shows live duration, estimated bill, amount paid so far, and outstanding balance.",
       "हर कार्ड पर लाइव समय, अनुमानित बिल, प्राप्त राशि और बकाया दिखता है।"],
      ["A red 'OVER LIMIT' badge appears when outstanding crosses the credit limit set in Settings.",
       "बकाया क्रेडिट लिमिट पार करने पर लाल 'OVER LIMIT' बैज दिखता है।"],
    ],
  },
  {
    en: "4. Payment Ledger",
    hi: "४. भुगतान बही",
    steps: [
      ["Tap 'Ledger' on any active card to see the full payment history for that vehicle.",
       "किसी भी सक्रिय कार्ड पर 'Ledger' दबाकर उस गाड़ी के सभी भुगतान देखें।"],
      ["Payments are recorded automatically at entry (advance) and final exit.",
       "भुगतान प्रवेश (अग्रिम) और अंतिम निकास पर स्वतः दर्ज होते हैं।"],
    ],
  },
  {
    en: "5. Edit Entry",
    hi: "५. एंट्री बदलें",
    steps: [
      ["If wrong wheel count, mobile or category was entered, tap 'Edit' on the card and correct the field.",
       "गलत पहिए, मोबाइल या श्रेणी दर्ज हो गई हो तो कार्ड पर 'Edit' दबाकर सही करें।"],
      ["Saving recalculates the daily rate. The entry time is preserved.",
       "सेव करने पर दैनिक दर अपने आप बदल जाती है। एंट्री समय वही रहता है।"],
    ],
  },
  {
    en: "6. Delete Entry (wrong data only)",
    hi: "६. एंट्री डिलीट (केवल गलत डेटा)",
    steps: [
      ["Use 'Delete' only when an entry was created by mistake. It is NOT a check-out.",
       "'Delete' का उपयोग केवल गलती से बनी एंट्री के लिए करें। यह चेक-आउट नहीं है।"],
      ["A confirmation dialog will warn you. The vehicle and all its payment rows are removed permanently and do NOT appear in reports.",
       "एक चेतावनी डायलॉग आएगा। गाड़ी और भुगतान हमेशा के लिए मिट जाते हैं और रिपोर्ट में नहीं आते।"],
      ["For an actual check-out always use the 'Exit' button instead.",
       "वास्तविक चेक-आउट के लिए हमेशा 'Exit' बटन का उपयोग करें।"],
    ],
  },
  {
    en: "7. Barcode Scan",
    hi: "७. बारकोड स्कैन",
    steps: [
      ["Tap the barcode icon next to the search bar to open the camera scanner.",
       "सर्च बार के पास बारकोड आइकन दबाकर कैमरा स्कैनर खोलें।"],
      ["Scan the barcode on the driver's entry slip. The matching vehicle is found and the Exit window opens automatically.",
       "एंट्री पर्ची का बारकोड स्कैन करें। मेल खाती गाड़ी मिलते ही Exit विंडो अपने आप खुलती है।"],
    ],
  },
  {
    en: "8. Barcode Scan",
    hi: "८. बारकोड स्कैन",
    steps: [
      ["Tap the barcode icon next to the search bar to open the camera scanner.",
       "सर्च बार के पास बारकोड आइकन दबाकर कैमरा स्कैनर खोलें।"],
      ["Scan the barcode on the driver's entry slip. The matching vehicle is found and the Exit window opens automatically.",
       "एंट्री पर्ची का बारकोड स्कैन करें। मेल खाती गाड़ी मिलते ही Exit विंडो अपने आप खुलती है।"],
    ],
  },
  {
    en: "9. Final Exit (Check-Out)",
    hi: "९. अंतिम निकास (चेक-आउट)",
    steps: [
      ["Tap 'Exit' on the vehicle card to start final check-out.",
       "गाड़ी कार्ड पर 'Exit' दबाकर अंतिम चेक-आउट शुरू करें।"],
      ["The exit modal shows entry time, exit time, total duration, daily rate, gross amount, paid and balance due.",
       "Exit विंडो में एंट्री, निकास, अवधि, दर, बिल, भुगतान और बकाया दिखते हैं।"],
      ["Collect any balance due in cash/UPI/card. Once collected, confirm exit — the record is saved as 'Paid' and moves to History.",
       "बकाया वसूल करें। पुष्टि करते ही रिकॉर्ड 'Paid' में सहेजा जाता है और इतिहास में जाता है।"],
      ["The final receipt opens — tap the pencil icon to edit any field before printing if needed, then Browser/Bluetooth Print.",
       "अंतिम रसीद खुलती है — प्रिंट से पहले पेंसिल आइकन से कोई भी फ़ील्ड बदल सकते हैं।"],
      ["You can re-print after editing — the printed copy shows the edited values.",
       "एडिट के बाद भी प्रिंट कर सकते हैं — प्रिंट पर बदले हुए मान आएँगे।"],
    ],
  },
  {
    en: "10. Vehicle History",
    hi: "१०. गाड़ी इतिहास",
    steps: [
      ["Open 'History' to see all checked-out vehicles.",
       "'History' खोलकर सभी निकली गाड़ियाँ देखें।"],
      ["Search by vehicle number or mobile; filter by date range.",
       "गाड़ी नंबर या मोबाइल से सर्च करें; तारीख से फ़िल्टर करें।"],
      ["Status will always read 'Paid' after exit — because the operator confirmed balance collection during exit.",
       "निकास के बाद स्थिति हमेशा 'Paid' दिखती है।"],
      ["Tap any row to view full details or re-print the final receipt.",
       "किसी भी पंक्ति पर टैप करके जानकारी देखें या रसीद दोबारा प्रिंट करें।"],
    ],
  },
  {
    en: "11. Monthly Passes",
    hi: "११. मासिक पास",
    steps: [
      ["Open 'Monthly Passes' to issue or renew a long-stay pass.",
       "लम्बी अवधि का पास जारी या रिन्यू करने के लिए 'Monthly Passes' खोलें।"],
      ["Fill vehicle, driver name, mobile, start date and number of days. Amount is calculated automatically.",
       "गाड़ी, ड्राइवर नाम, मोबाइल, शुरू तारीख और दिन भरें। राशि अपने आप जुड़ती है।"],
      ["Save and print the pass — driver shows it on every visit; no per-day billing applies.",
       "सेव और प्रिंट करें — ड्राइवर हर बार दिखाता है; प्रति-दिन शुल्क नहीं लगता।"],
    ],
  },
  {
    en: "12. Vehicle Stock",
    hi: "१२. वाहन स्टॉक",
    steps: [
      ["'Stock' shows the live count of vehicles inside the terminal grouped by wheel count.",
       "'Stock' पेज पर पहियों के अनुसार अंदर खड़ी गाड़ियों की संख्या दिखती है।"],
      ["Useful for shift handover and capacity planning.",
       "शिफ्ट हैंडओवर और जगह की योजना के लिए उपयोगी।"],
    ],
  },
  {
    en: "13. Reports",
    hi: "१३. रिपोर्ट",
    steps: [
      ["Open 'Reports' to see Today / Date-range views of revenue, exits and vehicle counts.",
       "'Reports' खोलकर आज / तारीख-सीमा की रिपोर्ट देखें।"],
      ["Switch between 'Daily' and 'Custom Range' tabs.",
       "'Daily' और 'Custom Range' टैब के बीच स्विच करें।"],
      ["Export to CSV or print the report for the owner / accountant.",
       "रिपोर्ट CSV में निर्यात करें या प्रिंट करें।"],
    ],
  },
  {
    en: "14. Settings",
    hi: "१४. सेटिंग्स",
    steps: [
      ["Receipt: company name, header, footer, contact info and prefix shown on every printed slip.",
       "रसीद: कंपनी का नाम, हेडर, फुटर, संपर्क और प्रीफ़िक्स।"],
      ["Pricing: per-day rate for each wheel-count category. Change carefully — affects all new entries.",
       "मूल्य: प्रत्येक पहिए श्रेणी की दैनिक दर। ध्यान से बदलें।"],
      ["UPI: UPI ID and payee name used in QR code for digital payments.",
       "UPI: डिजिटल भुगतान के QR कोड में उपयोग होने वाली UPI ID और नाम।"],
      ["Credit Limit: outstanding amount beyond which a vehicle is flagged 'OVER LIMIT'.",
       "क्रेडिट लिमिट: इससे ज़्यादा बकाया पर गाड़ी 'OVER LIMIT' दिखती है।"],
      ["Rest Hours: maximum hours a vehicle may stay out during temporary exit before raising an overstay alert.",
       "विश्राम घंटे: अस्थायी निकास में अधिकतम बाहर रहने का समय।"],
    ],
  },
  {
    en: "15. Troubleshooting",
    hi: "१५. समस्या समाधान",
    steps: [
      ["Bluetooth printer not connecting → ensure printer is ON, paired with the device, and you used Chrome. Try 'Browser Print' as fallback.",
       "ब्लूटूथ प्रिंटर कनेक्ट नहीं हो रहा → प्रिंटर चालू, पेयर और Chrome है — जाँचें। बैकअप के लिए 'Browser Print' करें।"],
      ["Old vehicle not in dropdown → type at least 2 letters of the number.",
       "पुरानी गाड़ी ड्रॉपडाउन में नहीं आ रही → कम-से-कम 2 अक्षर टाइप करें।"],
      ["Status shows wrong on a history row → all newly exited vehicles save as 'Paid'. Older 'Due' rows have been bulk-fixed.",
       "इतिहास पंक्ति पर गलत स्थिति → नई निकली गाड़ियाँ 'Paid' सहेजी जाती हैं।"],
      ["Wrong entry created → use 'Delete' on the active card; this does NOT create a history row.",
       "गलत एंट्री बन गई → सक्रिय कार्ड पर 'Delete' से हटाएँ।"],
      ["Page not updating → pull-to-refresh or reload the browser. Data auto-refreshes every 30 seconds.",
       "पेज अपडेट नहीं हो रहा → रीलोड करें। डेटा हर 30 सेकंड में ताज़ा होता है।"],
    ],
  },
  {
    en: "16. Daily Checklist",
    hi: "१६. दैनिक चेकलिस्ट",
    steps: [
      ["Morning: log in, check Active Vehicles for overnight stays, clear any TEMP OUT overstay alerts.",
       "सुबह: लॉगिन करें, रात की गाड़ियाँ देखें, TEMP OUT अलर्ट हल करें।"],
      ["Throughout the day: enter every new vehicle, record payments as collected, scan barcode at exit.",
       "दिनभर: हर नई गाड़ी दर्ज करें, भुगतान दर्ज करें, निकास पर स्कैन करें।"],
      ["Evening: open Reports → Daily → print or export to CSV → hand over to the owner / accountant.",
       "शाम: Reports → Daily → प्रिंट या CSV निर्यात करें।"],
      ["End of shift: tally cash collected against the 'Cash' total in the daily report.",
       "शिफ्ट समाप्ति: रिपोर्ट के 'Cash' कुल से नकद मिलाएँ।"],
    ],
  },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Help() {
  return (
    <div className="space-y-6 pb-24 md:pb-6 max-w-5xl mx-auto print-area">
      <Seo title="Operator Manual — Help" description="Step-by-step bilingual (English + Hindi) operator manual for the AIIPL Truck Parking Terminal — entry to exit." />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operator Manual</h1>
          <p className="text-muted-foreground">संचालक मार्गदर्शिका — एंट्री से निकास तक</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href="/AIIPL_Operator_Manual.pdf" target="_blank" rel="noopener noreferrer" download>
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </a>
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {/* In-page nav */}
      <Card className="print:hidden">
        <CardContent className="pt-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contents · विषय-सूची</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 text-sm">
            {SECTIONS.map(s => (
              <li key={s.en}>
                <a href={`#${slug(s.en)}`} className="text-primary hover:underline">
                  {s.en} <span className="text-muted-foreground">· {s.hi}</span>
                </a>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {SECTIONS.map(s => (
        <section key={s.en} id={slug(s.en)} className="scroll-mt-20">
          <div className="border-l-4 border-primary bg-primary/5 px-4 py-3 rounded-r-md mb-3">
            <h2 className="text-xl font-bold text-primary">{s.en}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{s.hi}</p>
          </div>
          <ol className="space-y-3 pl-1">
            {s.steps.map(([en, hi], i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">{i + 1}</span>
                <div className="space-y-1 flex-1">
                  <p className="leading-relaxed">{en}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{hi}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="text-xs text-muted-foreground text-center pt-6 border-t">
        AIIPL Truck Parking Terminal — Operator Manual v1 · संचालक मार्गदर्शिका
      </p>
    </div>
  );
}
