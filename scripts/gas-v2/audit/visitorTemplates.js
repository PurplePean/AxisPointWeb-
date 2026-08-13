'use strict';

/*
 * AUDIT-CANDIDATE VISITOR EMAIL TEMPLATES. NOT REVIEWED. NOT REACHABLE IN PRODUCTION.
 *
 * WHAT THIS IS. Model-generated translations of the two visitor-facing emails, the website
 * acknowledgement and the booking confirmation. No speaker of any of these languages has read
 * them. They are not approved, not professionally translated, and not production-ready.
 *
 * WHY IT LIVES OUTSIDE src/. `scripts/gas-v2/.claspignore` is an allowlist: only
 * `appsscript.json` and `src/*.js` are ever pushed to Apps Script. Putting these here means
 * they are structurally incapable of reaching the deployed project, which is the same kind of
 * guarantee the web audit catalogs get from the Vite alias. Nothing needs to remember to
 * exclude them.
 *
 * WHY IT IS UNREACHABLE EVEN IF PUSHED. `realTemplates(extraLocaleSets)` takes its locale
 * sets as an argument and has no production caller that passes any. Selection then runs
 * through `resolveOutboundLocale`, which only ever returns a locale in `LAUNCH_READY_LOCALES`
 * (`['en']`). So a visitor who asks for Spanish is recorded as wanting Spanish and answered in
 * English, deliberately, until a reviewed Spanish set exists.
 *
 * NO MUTABLE GLOBALS AND NO REGISTRATION API. This module exports a pure factory. It does not
 * install anything, and there is nothing here for a stray call to switch on at runtime.
 *
 * HOW THE TRANSLATIONS ARE APPLIED. Each locale renders by calling the ENGLISH renderer first
 * and then substituting phrases. That is deliberate: it means the structure, the escaping, the
 * plain-text and HTML parity, the links, and above all the booking INSTANT are produced by the
 * one reviewed code path and cannot drift per locale. Every substitution is checked, so a
 * missing phrase throws instead of sending a half-translated email.
 *
 * TWO RECORDED BOUNDARIES. A reviewer will see both and should treat them as known and
 * unfinished rather than as defects to report.
 *
 *   1. Row LABELS are translated; row VALUES are not. The values come from the backend's token
 *      label tables (`PROPERTY_TYPE_LABELS`, `TIMING_LABELS`, `BOOKING_MODE_LABELS` and the
 *      rest), so translating them means a parallel table per locale in `src/Labels.js`, which
 *      is backend surface rather than email copy and is not in this pass.
 *
 *   2. Translated paragraphs in the PLAIN-TEXT body are no longer wrapped at 60 columns. The
 *      match has to be whitespace-flexible to find a phrase `textWrap` split across lines, and
 *      the replacement goes in as one line. Re-wrapping it means reimplementing `textWrap`
 *      against eight scripts with different word-breaking rules, which is exactly the kind of
 *      thing that should be done once, properly, in `src`, after a native reader has read the
 *      copy. The HTML body, which is what nearly every recipient sees, is unaffected.
 *
 *   3. The booking date and time stay in English, DELIBERATELY and not as an oversight. The
 *      instant is produced by `formatInstant` on the one reviewed code path, which is what
 *      makes it provably identical in all nine languages. Localised date formatting would put
 *      that guarantee behind eight unreviewed formatters, and the failure it protects against,
 *      a translated email naming a different hour, is a meeting somebody misses. Localising
 *      the format is a separate reviewed change, made once, after a native reader signs off.
 */

/** Phrases shared by both templates. */
const COMMON_EN = {
  headerMeta: 'Property Management',
  replyAdd: 'You can reply to this message with anything you would like to add.',
  sentFrom: 'Sent from Houston, Texas.',
};

/**
 * Per-locale phrase tables.
 *
 * Keys mirror the English strings they replace. Anything absent falls through to English for
 * that phrase, and `renderFor` reports it, so an incomplete set is visible rather than silent.
 */
const PHRASES = {
  es: {
    ackEyebrow: 'Su solicitud',
    ackThankYouNamed: 'Gracias, {name}. ',
    ackThankYou: 'Gracias. ',
    ackHaveProperty: 'Tenemos los datos de su propiedad.',
    ackHaveMessage: 'Tenemos su mensaje.',
    ackLead:
      'Un socio revisará lo que envió y le responderá. Este mensaje confirma lo que nos llegó.',
    ackPanelProperty: 'La propiedad',
    ackPanelSent: 'Lo que envió',
    ackSubjectProperty: 'Tenemos los datos de su propiedad',
    ackSubjectMessage: 'Tenemos su mensaje',
    ackPreheader: 'Tenemos sus datos. Esto es lo que sigue.',
    ackFooterNote:
      'Recibe este mensaje porque contactó a AxisPoint Partners sobre administración de propiedades.',
    bookEyebrow: 'Llamada confirmada',
    bookHeadlineNamed: 'Ya está en el calendario, {name}.',
    bookHeadline: 'Ya está en el calendario.',
    bookLead:
      'Estos son los detalles. Puede responder a este mensaje si algo necesita cambiar.',
    bookPanel: 'Su llamada',
    bookSubject: 'Su llamada está confirmada',
    bookPreheader: 'Su llamada está confirmada.',
    bookFooterNote:
      'Recibe este mensaje porque programó una llamada con AxisPoint Partners.',
    bookNote:
      'No hay nada que preparar. Si ya tiene a mano un registro de rentas o un estado operativo puede ser útil, y si no, la conversación funciona igual.',
    rowWhen: 'Cuándo',
    rowFormat: 'Formato',
    rowLength: 'Duración',
    rowPropertyOrPortfolio: 'Propiedad o cartera',
    rowType: 'Tipo',
    rowScope: 'Alcance',
    rowScale: 'Unidades o metros cuadrados',
    rowOwnershipGroup: 'Grupo propietario',
    rowServiceInterest: 'Servicio de interés',
    rowTiming: 'Plazo',
    rowPathway: 'Vía',
    rowTopic: 'Tema',
    replyAdd: 'Puede responder a este mensaje con cualquier cosa que quiera añadir.',
    replyAnyTime: 'Puede responder a este mensaje en cualquier momento.',
  },
  'zh-Hans': {
    ackEyebrow: '您的请求',
    ackThankYouNamed: '谢谢您，{name}。',
    ackThankYou: '谢谢您。',
    ackHaveProperty: '我们已收到您的物业信息。',
    ackHaveMessage: '我们已收到您的留言。',
    ackLead: '会有一位合伙人查看您提交的内容并回复。本邮件确认我们收到了哪些信息。',
    ackPanelProperty: '该物业',
    ackPanelSent: '您提交的内容',
    ackSubjectProperty: '我们已收到您的物业信息',
    ackSubjectMessage: '我们已收到您的留言',
    ackPreheader: '我们已收到您的信息。以下是接下来的安排。',
    ackFooterNote: '您收到本邮件，是因为您就物业管理事宜联系了 AxisPoint Partners。',
    bookEyebrow: '通话已确认',
    bookHeadlineNamed: '{name}，您已列入日程。',
    bookHeadline: '您已列入日程。',
    bookLead: '以下是详细信息。如需调整，请直接回复本邮件。',
    bookPanel: '您的通话',
    bookSubject: '您的通话已确认',
    bookPreheader: '您的通话已确认。',
    bookFooterNote: '您收到本邮件，是因为您与 AxisPoint Partners 预约了通话。',
    bookNote:
      '无需准备任何材料。如果手边已有租金表或经营报表会有帮助，没有也不影响沟通。',
    rowWhen: '时间',
    rowFormat: '形式',
    rowLength: '时长',
    rowPropertyOrPortfolio: '物业或投资组合',
    rowType: '类型',
    rowScope: '范围',
    rowScale: '单元数或建筑面积',
    rowOwnershipGroup: '业主方',
    rowServiceInterest: '服务需求',
    rowTiming: '时间安排',
    rowPathway: '咨询类型',
    rowTopic: '主题',
    replyAdd: '如有任何补充，请直接回复本邮件。',
    replyAnyTime: '您随时可以回复本邮件。',
  },
  'zh-Hant': {
    ackEyebrow: '您的請求',
    ackThankYouNamed: '謝謝您，{name}。',
    ackThankYou: '謝謝您。',
    ackHaveProperty: '我們已收到您的物業資料。',
    ackHaveMessage: '我們已收到您的留言。',
    ackLead: '會有一位合夥人檢視您送出的內容並回覆。本郵件確認我們收到了哪些資料。',
    ackPanelProperty: '該物業',
    ackPanelSent: '您送出的內容',
    ackSubjectProperty: '我們已收到您的物業資料',
    ackSubjectMessage: '我們已收到您的留言',
    ackPreheader: '我們已收到您的資料。以下是接下來的安排。',
    ackFooterNote: '您收到本郵件，是因為您就物業管理事宜聯絡了 AxisPoint Partners。',
    bookEyebrow: '通話已確認',
    bookHeadlineNamed: '{name}，您已排入行事曆。',
    bookHeadline: '您已排入行事曆。',
    bookLead: '以下是詳細資訊。如需調整，請直接回覆本郵件。',
    bookPanel: '您的通話',
    bookSubject: '您的通話已確認',
    bookPreheader: '您的通話已確認。',
    bookFooterNote: '您收到本郵件，是因為您與 AxisPoint Partners 預約了通話。',
    bookNote:
      '不需要準備任何資料。如果手邊已有租金表或營運報表會有幫助，沒有也不影響洽談。',
    rowWhen: '時間',
    rowFormat: '形式',
    rowLength: '長度',
    rowPropertyOrPortfolio: '物業或投資組合',
    rowType: '類型',
    rowScope: '範圍',
    rowScale: '單元數或建築面積',
    rowOwnershipGroup: '業主方',
    rowServiceInterest: '服務需求',
    rowTiming: '時間安排',
    rowPathway: '諮詢類型',
    rowTopic: '主題',
    replyAdd: '如有任何補充，請直接回覆本郵件。',
    replyAnyTime: '您隨時可以回覆本郵件。',
  },
  vi: {
    ackEyebrow: 'Yêu cầu của quý vị',
    ackThankYouNamed: 'Cảm ơn {name}. ',
    ackThankYou: 'Cảm ơn quý vị. ',
    ackHaveProperty: 'Chúng tôi đã nhận thông tin bất động sản của quý vị.',
    ackHaveMessage: 'Chúng tôi đã nhận lời nhắn của quý vị.',
    ackLead:
      'Một đối tác sẽ xem lại những gì quý vị gửi và phản hồi. Thư này xác nhận những gì đã đến với chúng tôi.',
    ackPanelProperty: 'Bất động sản',
    ackPanelSent: 'Những gì quý vị đã gửi',
    ackSubjectProperty: 'Chúng tôi đã nhận thông tin bất động sản của quý vị',
    ackSubjectMessage: 'Chúng tôi đã nhận lời nhắn của quý vị',
    ackPreheader: 'Chúng tôi đã nhận thông tin của quý vị. Đây là các bước tiếp theo.',
    ackFooterNote:
      'Quý vị nhận được thư này vì đã liên hệ AxisPoint Partners về quản lý bất động sản.',
    bookEyebrow: 'Đã xác nhận cuộc gọi',
    bookHeadlineNamed: 'Quý vị đã có trong lịch, {name}.',
    bookHeadline: 'Quý vị đã có trong lịch.',
    bookLead:
      'Đây là các chi tiết. Quý vị có thể trả lời thư này nếu cần thay đổi điều gì.',
    bookPanel: 'Cuộc gọi của quý vị',
    bookSubject: 'Cuộc gọi của quý vị đã được xác nhận',
    bookPreheader: 'Cuộc gọi của quý vị đã được xác nhận.',
    bookFooterNote:
      'Quý vị nhận được thư này vì đã đặt một cuộc gọi với AxisPoint Partners.',
    bookNote:
      'Không cần chuẩn bị gì. Nếu quý vị đã có sẵn bảng tiền thuê hoặc báo cáo hoạt động thì hữu ích, còn không thì cuộc trao đổi vẫn diễn ra bình thường.',
    rowWhen: 'Thời gian',
    rowFormat: 'Hình thức',
    rowLength: 'Thời lượng',
    rowPropertyOrPortfolio: 'Bất động sản hoặc danh mục',
    rowType: 'Loại',
    rowScope: 'Phạm vi',
    rowScale: 'Số căn hoặc diện tích',
    rowOwnershipGroup: 'Nhóm sở hữu',
    rowServiceInterest: 'Dịch vụ quan tâm',
    rowTiming: 'Thời điểm',
    rowPathway: 'Hướng liên hệ',
    rowTopic: 'Chủ đề',
    replyAdd: 'Quý vị có thể trả lời thư này kèm bất cứ điều gì muốn bổ sung.',
    replyAnyTime: 'Quý vị có thể trả lời thư này bất cứ lúc nào.',
  },
  hi: {
    ackEyebrow: 'आपका अनुरोध',
    ackThankYouNamed: 'धन्यवाद, {name}। ',
    ackThankYou: 'धन्यवाद। ',
    ackHaveProperty: 'आपकी संपत्ति का विवरण हमें मिल गया है।',
    ackHaveMessage: 'आपका संदेश हमें मिल गया है।',
    ackLead:
      'एक साझेदार आपके भेजे गए विवरण की समीक्षा करेगा और उत्तर देगा। यह संदेश पुष्टि करता है कि हम तक क्या पहुंचा।',
    ackPanelProperty: 'संपत्ति',
    ackPanelSent: 'आपने क्या भेजा',
    ackSubjectProperty: 'आपकी संपत्ति का विवरण हमें मिल गया है',
    ackSubjectMessage: 'आपका संदेश हमें मिल गया है',
    ackPreheader: 'हमें आपका विवरण मिल गया है। आगे यह होगा।',
    ackFooterNote:
      'आपको यह संदेश इसलिए मिला क्योंकि आपने संपत्ति प्रबंधन के बारे में AxisPoint Partners से संपर्क किया।',
    bookEyebrow: 'कॉल पक्की हुई',
    bookHeadlineNamed: 'आप कैलेंडर में हैं, {name}।',
    bookHeadline: 'आप कैलेंडर में हैं।',
    bookLead:
      'विवरण नीचे है। कुछ बदलना हो तो आप इस संदेश का उत्तर दे सकते हैं।',
    bookPanel: 'आपकी कॉल',
    bookSubject: 'आपकी कॉल पक्की हो गई है',
    bookPreheader: 'आपकी कॉल पक्की हो गई है।',
    bookFooterNote:
      'आपको यह संदेश इसलिए मिला क्योंकि आपने AxisPoint Partners के साथ कॉल तय की।',
    bookNote:
      'तैयारी के लिए कुछ नहीं चाहिए। यदि रेंट रोल या ऑपरेटिंग स्टेटमेंट पहले से पास है तो उपयोगी है, और न हो तब भी बातचीत हो जाती है।',
    rowWhen: 'कब',
    rowFormat: 'स्वरूप',
    rowLength: 'अवधि',
    rowPropertyOrPortfolio: 'संपत्ति या पोर्टफोलियो',
    rowType: 'प्रकार',
    rowScope: 'दायरा',
    rowScale: 'इकाइयां या क्षेत्रफल',
    rowOwnershipGroup: 'स्वामित्व समूह',
    rowServiceInterest: 'सेवा में रुचि',
    rowTiming: 'समय',
    rowPathway: 'माध्यम',
    rowTopic: 'विषय',
    replyAdd: 'जो कुछ जोड़ना हो, आप इस संदेश का उत्तर देकर बता सकते हैं।',
    replyAnyTime: 'आप इस संदेश का उत्तर कभी भी दे सकते हैं।',
  },
  ur: {
    ackEyebrow: 'آپ کی درخواست',
    ackThankYouNamed: 'شکریہ، {name}۔ ',
    ackThankYou: 'شکریہ۔ ',
    ackHaveProperty: 'ہمیں آپ کی جائیداد کی تفصیلات مل گئی ہیں۔',
    ackHaveMessage: 'ہمیں آپ کا پیغام مل گیا ہے۔',
    ackLead:
      'ایک شراکت دار آپ کی بھیجی گئی تفصیلات کا جائزہ لے کر جواب دے گا۔ یہ پیغام تصدیق کرتا ہے کہ ہم تک کیا پہنچا۔',
    ackPanelProperty: 'جائیداد',
    ackPanelSent: 'آپ نے کیا بھیجا',
    ackSubjectProperty: 'ہمیں آپ کی جائیداد کی تفصیلات مل گئی ہیں',
    ackSubjectMessage: 'ہمیں آپ کا پیغام مل گیا ہے',
    ackPreheader: 'ہمیں آپ کی تفصیلات مل گئی ہیں۔ آگے یہ ہوگا۔',
    ackFooterNote:
      'آپ کو یہ پیغام اس لیے موصول ہوا کیونکہ آپ نے جائیداد کے انتظام کے بارے میں AxisPoint Partners سے رابطہ کیا۔',
    bookEyebrow: 'کال طے ہو گئی',
    bookHeadlineNamed: 'آپ کیلنڈر میں شامل ہیں، {name}۔',
    bookHeadline: 'آپ کیلنڈر میں شامل ہیں۔',
    bookLead: 'تفصیلات درج ذیل ہیں۔ کچھ تبدیل کرنا ہو تو اس پیغام کا جواب دیں۔',
    bookPanel: 'آپ کی کال',
    bookSubject: 'آپ کی کال طے ہو گئی ہے',
    bookPreheader: 'آپ کی کال طے ہو گئی ہے۔',
    bookFooterNote:
      'آپ کو یہ پیغام اس لیے موصول ہوا کیونکہ آپ نے AxisPoint Partners کے ساتھ کال طے کی۔',
    bookNote:
      'تیاری کے لیے کچھ درکار نہیں۔ اگر کرایہ ریکارڈ یا آپریٹنگ اسٹیٹمنٹ پہلے سے موجود ہو تو مفید ہے، اور نہ ہو تب بھی گفتگو ہو جاتی ہے۔',
    rowWhen: 'کب',
    rowFormat: 'طریقہ',
    rowLength: 'دورانیہ',
    rowPropertyOrPortfolio: 'جائیداد یا پورٹ فولیو',
    rowType: 'قسم',
    rowScope: 'دائرہ کار',
    rowScale: 'یونٹس یا رقبہ',
    rowOwnershipGroup: 'مالک گروپ',
    rowServiceInterest: 'مطلوبہ خدمت',
    rowTiming: 'وقت',
    rowPathway: 'ذریعہ',
    rowTopic: 'موضوع',
    replyAdd: 'جو کچھ شامل کرنا ہو، آپ اس پیغام کا جواب دے کر بتا سکتے ہیں۔',
    replyAnyTime: 'آپ اس پیغام کا جواب کسی بھی وقت دے سکتے ہیں۔',
  },
  gu: {
    ackEyebrow: 'તમારી વિનંતી',
    ackThankYouNamed: 'આભાર, {name}. ',
    ackThankYou: 'આભાર. ',
    ackHaveProperty: 'અમને તમારી મિલકતની વિગતો મળી ગઈ છે.',
    ackHaveMessage: 'અમને તમારો સંદેશ મળી ગયો છે.',
    ackLead:
      'એક ભાગીદાર તમે મોકલેલી વિગતોની સમીક્ષા કરશે અને જવાબ આપશે. આ સંદેશ પુષ્ટિ કરે છે કે અમારા સુધી શું પહોંચ્યું.',
    ackPanelProperty: 'મિલકત',
    ackPanelSent: 'તમે શું મોકલ્યું',
    ackSubjectProperty: 'અમને તમારી મિલકતની વિગતો મળી ગઈ છે',
    ackSubjectMessage: 'અમને તમારો સંદેશ મળી ગયો છે',
    ackPreheader: 'અમને તમારી વિગતો મળી ગઈ છે. હવે આગળ આ થશે.',
    ackFooterNote:
      'તમને આ સંદેશ મળ્યો કારણ કે તમે મિલકત વ્યવસ્થાપન વિશે AxisPoint Partners નો સંપર્ક કર્યો.',
    bookEyebrow: 'કૉલ નક્કી થયો',
    bookHeadlineNamed: 'તમે કૅલેન્ડરમાં છો, {name}.',
    bookHeadline: 'તમે કૅલેન્ડરમાં છો.',
    bookLead: 'વિગતો નીચે છે. કંઈ બદલવું હોય તો આ સંદેશનો જવાબ આપો.',
    bookPanel: 'તમારો કૉલ',
    bookSubject: 'તમારો કૉલ નક્કી થઈ ગયો છે',
    bookPreheader: 'તમારો કૉલ નક્કી થઈ ગયો છે.',
    bookFooterNote:
      'તમને આ સંદેશ મળ્યો કારણ કે તમે AxisPoint Partners સાથે કૉલ ગોઠવ્યો.',
    bookNote:
      'તૈયારી માટે કંઈ જોઈતું નથી. ભાડાની નોંધ કે સંચાલન અહેવાલ પહેલેથી હાથમાં હોય તો ઉપયોગી છે, અને ન હોય તો પણ વાતચીત થઈ શકે છે.',
    rowWhen: 'ક્યારે',
    rowFormat: 'સ્વરૂપ',
    rowLength: 'અવધિ',
    rowPropertyOrPortfolio: 'મિલકત અથવા પોર્ટફોલિયો',
    rowType: 'પ્રકાર',
    rowScope: 'વ્યાપ',
    rowScale: 'એકમો અથવા ક્ષેત્રફળ',
    rowOwnershipGroup: 'માલિકી જૂથ',
    rowServiceInterest: 'સેવામાં રસ',
    rowTiming: 'સમય',
    rowPathway: 'માર્ગ',
    rowTopic: 'વિષય',
    replyAdd: 'જે કંઈ ઉમેરવું હોય, તમે આ સંદેશનો જવાબ આપીને જણાવી શકો છો.',
    replyAnyTime: 'તમે આ સંદેશનો જવાબ ગમે ત્યારે આપી શકો છો.',
  },
  pa: {
    ackEyebrow: 'ਤੁਹਾਡੀ ਬੇਨਤੀ',
    ackThankYouNamed: 'ਧੰਨਵਾਦ, {name}। ',
    ackThankYou: 'ਧੰਨਵਾਦ। ',
    ackHaveProperty: 'ਸਾਨੂੰ ਤੁਹਾਡੀ ਜਾਇਦਾਦ ਦੇ ਵੇਰਵੇ ਮਿਲ ਗਏ ਹਨ।',
    ackHaveMessage: 'ਸਾਨੂੰ ਤੁਹਾਡਾ ਸੁਨੇਹਾ ਮਿਲ ਗਿਆ ਹੈ।',
    ackLead:
      'ਇੱਕ ਭਾਈਵਾਲ ਤੁਹਾਡੇ ਭੇਜੇ ਵੇਰਵਿਆਂ ਦੀ ਸਮੀਖਿਆ ਕਰੇਗਾ ਅਤੇ ਜਵਾਬ ਦੇਵੇਗਾ। ਇਹ ਸੁਨੇਹਾ ਪੁਸ਼ਟੀ ਕਰਦਾ ਹੈ ਕਿ ਸਾਡੇ ਤੱਕ ਕੀ ਪਹੁੰਚਿਆ।',
    ackPanelProperty: 'ਜਾਇਦਾਦ',
    ackPanelSent: 'ਤੁਸੀਂ ਕੀ ਭੇਜਿਆ',
    ackSubjectProperty: 'ਸਾਨੂੰ ਤੁਹਾਡੀ ਜਾਇਦਾਦ ਦੇ ਵੇਰਵੇ ਮਿਲ ਗਏ ਹਨ',
    ackSubjectMessage: 'ਸਾਨੂੰ ਤੁਹਾਡਾ ਸੁਨੇਹਾ ਮਿਲ ਗਿਆ ਹੈ',
    ackPreheader: 'ਸਾਨੂੰ ਤੁਹਾਡੇ ਵੇਰਵੇ ਮਿਲ ਗਏ ਹਨ। ਅੱਗੇ ਇਹ ਹੋਵੇਗਾ।',
    ackFooterNote:
      'ਤੁਹਾਨੂੰ ਇਹ ਸੁਨੇਹਾ ਇਸ ਲਈ ਮਿਲਿਆ ਕਿਉਂਕਿ ਤੁਸੀਂ ਜਾਇਦਾਦ ਪ੍ਰਬੰਧਨ ਬਾਰੇ AxisPoint Partners ਨਾਲ ਸੰਪਰਕ ਕੀਤਾ।',
    bookEyebrow: 'ਕਾਲ ਪੱਕੀ ਹੋਈ',
    bookHeadlineNamed: 'ਤੁਸੀਂ ਕੈਲੰਡਰ ਵਿੱਚ ਹੋ, {name}।',
    bookHeadline: 'ਤੁਸੀਂ ਕੈਲੰਡਰ ਵਿੱਚ ਹੋ।',
    bookLead: 'ਵੇਰਵੇ ਹੇਠਾਂ ਹਨ। ਕੁਝ ਬਦਲਣਾ ਹੋਵੇ ਤਾਂ ਇਸ ਸੁਨੇਹੇ ਦਾ ਜਵਾਬ ਦਿਓ।',
    bookPanel: 'ਤੁਹਾਡੀ ਕਾਲ',
    bookSubject: 'ਤੁਹਾਡੀ ਕਾਲ ਪੱਕੀ ਹੋ ਗਈ ਹੈ',
    bookPreheader: 'ਤੁਹਾਡੀ ਕਾਲ ਪੱਕੀ ਹੋ ਗਈ ਹੈ।',
    bookFooterNote:
      'ਤੁਹਾਨੂੰ ਇਹ ਸੁਨੇਹਾ ਇਸ ਲਈ ਮਿਲਿਆ ਕਿਉਂਕਿ ਤੁਸੀਂ AxisPoint Partners ਨਾਲ ਕਾਲ ਤੈਅ ਕੀਤੀ।',
    bookNote:
      'ਤਿਆਰੀ ਲਈ ਕੁਝ ਨਹੀਂ ਚਾਹੀਦਾ। ਜੇ ਕਿਰਾਏ ਦਾ ਰਿਕਾਰਡ ਜਾਂ ਸੰਚਾਲਨ ਬਿਆਨ ਪਹਿਲਾਂ ਹੀ ਕੋਲ ਹੈ ਤਾਂ ਲਾਭਦਾਇਕ ਹੈ, ਅਤੇ ਨਾ ਹੋਵੇ ਤਾਂ ਵੀ ਗੱਲਬਾਤ ਹੋ ਜਾਂਦੀ ਹੈ।',
    rowWhen: 'ਕਦੋਂ',
    rowFormat: 'ਰੂਪ',
    rowLength: 'ਮਿਆਦ',
    rowPropertyOrPortfolio: 'ਜਾਇਦਾਦ ਜਾਂ ਪੋਰਟਫੋਲੀਓ',
    rowType: 'ਕਿਸਮ',
    rowScope: 'ਦਾਇਰਾ',
    rowScale: 'ਇਕਾਈਆਂ ਜਾਂ ਖੇਤਰਫਲ',
    rowOwnershipGroup: 'ਮਾਲਕੀ ਸਮੂਹ',
    rowServiceInterest: 'ਸੇਵਾ ਵਿੱਚ ਦਿਲਚਸਪੀ',
    rowTiming: 'ਸਮਾਂ',
    rowPathway: 'ਰਾਹ',
    rowTopic: 'ਵਿਸ਼ਾ',
    replyAdd: 'ਜੋ ਕੁਝ ਜੋੜਨਾ ਹੋਵੇ, ਤੁਸੀਂ ਇਸ ਸੁਨੇਹੇ ਦਾ ਜਵਾਬ ਦੇ ਕੇ ਦੱਸ ਸਕਦੇ ਹੋ।',
    replyAnyTime: 'ਤੁਸੀਂ ਇਸ ਸੁਨੇਹੇ ਦਾ ਜਵਾਬ ਕਿਸੇ ਵੇਲੇ ਵੀ ਦੇ ਸਕਦੇ ਹੋ।',
  },
};

/**
 * Applies an ordered substitution plan across a whole rendered message.
 *
 * PRESENCE IS CHECKED PER MESSAGE, NOT PER FIELD. The first version of this checked each of
 * `subject`, `htmlBody` and `textBody` independently and threw when a phrase was absent from
 * any one of them, which is wrong in two ordinary cases: the booking headline never appears in
 * the subject, and a proposal acknowledgement genuinely never contains the general-inquiry
 * subject line. A phrase has to be found SOMEWHERE in the message, not everywhere in it.
 *
 * `required` carries the rest. It is branch-aware, so the phrases that must still exist are
 * demanded and the ones that legitimately may not appear (a panel title on a lead who filled
 * in nothing optional) are not.
 *
 * A SILENT MISS IS THE FAILURE WORTH PREVENTING. If the English renderer changes a phrase and
 * a locale table still names the old one, an unchecked replace would quietly send a message
 * that is English in that spot and translated elsewhere. This makes that a test failure.
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every written form a phrase can take in the rendered message.
 *
 * THE PLAIN-TEXT BODY IS NOT THE HTML BODY WITH TAGS REMOVED, which the first version of this
 * assumed and which cost it most of the Spanish text email. `textRule` UPPERCASES a heading,
 * so "Your call" is written "YOUR CALL"; and `textWrap` inserts a newline at a space, so
 * "...reply to this message if anything needs to change." arrives split across two lines. A
 * plain `indexOf` matches neither, so the substitution silently did nothing and the message
 * went out with English headings and English paragraphs beside translated labels.
 *
 * Matching therefore has to be case-aware and whitespace-flexible, and any run of whitespace in
 * the source phrase has to match any run of whitespace in the output.
 */
/**
 * Whitespace-flexible pattern for one written form, anchored at word boundaries.
 *
 * THE BOUNDARIES ARE NOT DECORATION. Without them "Format" matches inside its own Spanish
 * replacement "Formato", so the residue check reports a correctly translated label as
 * untranslated, and a second substitution pass would corrupt it. The phrases are always the
 * English source strings, so ASCII `\w` is the right notion of a word here.
 *
 * A boundary is added only on a side that actually ends in a word character: several phrases
 * end in a full stop or a space, where `\b` would assert the opposite of what is meant.
 */
function patternFor(form) {
  const body = escapeRegExp(form).replace(/(\\?\s)+/g, '\\s+');
  return (/^\w/.test(form) ? '\\b' : '') + body + (/\w$/.test(form) ? '\\b' : '');
}

function formsOf(find) {
  const forms = [find];
  const upper = find.toUpperCase();
  if (upper !== find) forms.push(upper);
  return forms.map((form) => ({
    pattern: patternFor(form),
    upper: form === upper && upper !== find,
  }));
}

/** True when any written form of `find` survives anywhere in the message. */
function residual(fields, find) {
  return Object.keys(fields).some((key) =>
    formsOf(find).some((form) => new RegExp(form.pattern).test(fields[key])),
  );
}

function applyPlan(base, plan, where) {
  const fields = { subject: base.subject, htmlBody: base.htmlBody, textBody: base.textBody };
  const missing = [];

  for (const step of plan) {
    if (step.to === undefined) {
      if (!missing.includes(step.find)) missing.push(step.find);
      continue;
    }
    if (step.to === step.find) continue;

    const present = residual(fields, step.find);

    for (const form of formsOf(step.find)) {
      // An uppercased heading gets an uppercased translation. Scripts without case are
      // unaffected by `toUpperCase`, so this is a no-op for the six non-Latin locales.
      const to = form.upper ? step.to.toUpperCase() : step.to;
      const re = new RegExp(form.pattern, 'g');
      for (const key of Object.keys(fields)) {
        // A function replacement, so a `$` in a translation cannot be read as a backreference.
        fields[key] = fields[key].replace(re, () => to);
      }
    }

    /*
     * TWO DISTINCT FAILURES, BOTH FATAL.
     *
     * A required phrase that was never there means the English renderer changed its wording and
     * this table still names the old one: the stale-table case.
     *
     * A phrase still present AFTER substitution means some written form of it was not matched,
     * which is precisely the bug above. Checking the residue rather than counting hits is what
     * makes that impossible to miss: a phrase replaced in the HTML but not in the plain text
     * used to satisfy a hit count while leaving half the message in English.
     */
    if (step.required && !present) {
      throw new Error(
        `audit template ${where}: expected phrase not found in the rendered message: ` +
          JSON.stringify(step.find),
      );
    }
    if (residual(fields, step.find)) {
      throw new Error(
        `audit template ${where}: English survived substitution: ${JSON.stringify(step.find)}`,
      );
    }
  }

  // A `{name}` that survived means a table used the placeholder in a phrase the plan feeds
  // without a name. Shipping that literal to a reader is worse than failing here.
  const unresolved = Object.keys(fields).filter((k) => fields[k].indexOf('{name}') !== -1);
  if (unresolved.length > 0) {
    throw new Error(
      `audit template ${where}: unresolved {name} placeholder in ${unresolved.join(', ')}`,
    );
  }

  return {
    ok: true,
    subject: fields.subject,
    htmlBody: fields.htmlBody,
    textBody: fields.textBody,
    auditCandidate: true,
    untranslatedPhrases: missing,
  };
}

function firstNameOf(fullName) {
  const s = String(fullName || '').trim();
  if (!s) return '';
  return s.split(/\s+/)[0];
}

/**
 * Builds the audit-candidate locale sets for injection into `realTemplates`.
 *
 * `ctx` is the loaded gas-v2 global context: the English renderers come from there, so the
 * reviewed code path produces the structure and every value, including the booking instant.
 */
function auditVisitorTemplateSets(ctx) {
  const sets = {};

  for (const code of Object.keys(PHRASES)) {
    const p = PHRASES[code];

    sets[code] = {
      renderAcknowledgement(lead, config) {
        const base = ctx.renderWebsiteAcknowledgement(lead, config);
        if (!base || !base.ok) return base;

        const first = firstNameOf(lead.fullName);
        const isProposal = lead.pathway === 'management_proposal';

        /*
         * Ordered longest-first, so a short phrase cannot eat a prefix of a longer one that has
         * not been substituted yet. Single-word row labels go LAST for the same reason.
         *
         * The two subject lines are mutually exclusive: whichever branch this lead is not on is
         * absent from the message by design, so only the applicable one is required.
         * Panel titles and row labels are never required, because a lead who filled in nothing
         * optional produces no panel at all.
         */
        const plan = [
          { find: 'A Partner will review what you sent and reply to you. This message confirms what reached us.', to: p.ackLead, required: true },
          { find: 'You are receiving this because you contacted AxisPoint Partners about property management.', to: p.ackFooterNote, required: true },
          { find: 'We have your details. Here is what happens next.', to: p.ackPreheader, required: true },
          { find: COMMON_EN.replyAdd, to: p.replyAdd, required: true },
          { find: 'We have your property details', to: p.ackSubjectProperty, required: isProposal },
          { find: 'We have your message', to: p.ackSubjectMessage, required: !isProposal },
          {
            find: first ? `Thank you, ${first}. ` : 'Thank you. ',
            to: first ? String(p.ackThankYouNamed).replace('{name}', first) : p.ackThankYou,
            required: true,
          },
          { find: 'Units or square footage', to: p.rowScale, required: false },
          { find: 'Property or portfolio', to: p.rowPropertyOrPortfolio, required: false },
          { find: 'Service interest', to: p.rowServiceInterest, required: false },
          { find: 'Ownership group', to: p.rowOwnershipGroup, required: false },
          { find: 'What you sent', to: p.ackPanelSent, required: false },
          { find: 'The property', to: p.ackPanelProperty, required: false },
          { find: 'Your request', to: p.ackEyebrow, required: true },
          { find: 'Pathway', to: p.rowPathway, required: false },
          { find: 'Timing', to: p.rowTiming, required: false },
          { find: 'Topic', to: p.rowTopic, required: false },
          { find: 'Scope', to: p.rowScope, required: false },
          { find: 'Type', to: p.rowType, required: false },
        ];

        return applyPlan(base, plan, `${code}.renderAcknowledgement`);
      },

      renderBookingConfirmation(lead, booking, config) {
        const base = ctx.renderBookingConfirmation(lead, booking, config);
        if (!base || !base.ok) return base;

        const first = firstNameOf(lead.fullName);

        /*
         * Every phrase here is required: unlike the acknowledgement, this template has no
         * optional rows and no pathway branch. All three rows are always present.
         *
         * ORDER IS LOAD-BEARING IN TWO PLACES. The preheader is the subject plus a full
         * stop, so it must be substituted first or the subject rule would leave a stray English
         * period trailing a translated sentence; and the panel title "Your call" is a prefix of
         * "Your call is confirmed", so it must come after both.
         */
        const plan = [
          { find: 'Nothing to prepare. If you already have a rent roll or operating statement at hand it can be useful, and if not the conversation works without it.', to: p.bookNote, required: true },
          { find: 'Here are the details. You can reply to this message if anything needs to change.', to: p.bookLead, required: true },
          { find: 'You are receiving this because you scheduled a call with AxisPoint Partners.', to: p.bookFooterNote, required: true },
          { find: 'You can reply to this message at any time.', to: p.replyAnyTime, required: true },
          {
            find: first ? `You are on the calendar, ${first}.` : 'You are on the calendar.',
            to: first ? String(p.bookHeadlineNamed).replace('{name}', first) : p.bookHeadline,
            required: true,
          },
          { find: 'Your call is confirmed.', to: p.bookPreheader, required: true },
          { find: 'Your call is confirmed', to: p.bookSubject, required: true },
          { find: 'Call confirmed', to: p.bookEyebrow, required: true },
          { find: 'Your call', to: p.bookPanel, required: true },
          { find: 'Format', to: p.rowFormat, required: true },
          { find: 'Length', to: p.rowLength, required: true },
          { find: 'When', to: p.rowWhen, required: true },
        ];

        return applyPlan(base, plan, `${code}.renderBookingConfirmation`);
      },
    };
  }

  return sets;
}

module.exports = { auditVisitorTemplateSets, PHRASES };
