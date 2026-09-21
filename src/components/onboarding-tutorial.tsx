"use client";

import { useState } from "react";
import { BookOpen, UploadCloud, MessageSquare, ListChecks, FileText, ArrowRight, ArrowLeft, X } from "lucide-react";
import { useLang } from "@/context/lang-context";
import { pick } from "@/lib/translate";

// Each array is 20 entries long, in LANGS order (ru, uz, kk, uk, az, ky, tg, be,
// hy, ka, tk, en, es, pt, ar, tr, hi, ja, ko, de) — see src/lib/translate.ts.
type Step = {
  icon: typeof BookOpen;
  color: string;
  title: readonly string[];
  text: readonly string[];
};

const STEPS: Step[] = [
  {
    icon: BookOpen,
    color: "#7c3aed",
    title: [
      "Добро пожаловать в KnowledgeAI", "KnowledgeAI'ga xush kelibsiz", "KnowledgeAI-ге қош келдіңіз", "Ласкаво просимо до KnowledgeAI", "KnowledgeAI-ə xoş gəlmisiniz", "KnowledgeAI'ге кош келдиңиз", "Хуш омадед ба KnowledgeAI", "Сардэчна запрашаем у KnowledgeAI", "Բարի գալուստ KnowledgeAI", "მოგესალმებით KnowledgeAI-ში", "KnowledgeAI-a hoş geldiňiz", "Welcome to KnowledgeAI", "Bienvenido a KnowledgeAI", "Bem-vindo ao KnowledgeAI", "مرحباً بك في KnowledgeAI", "KnowledgeAI'a hoş geldiniz", "KnowledgeAI में आपका स्वागत है", "KnowledgeAIへようこそ", "KnowledgeAI에 오신 것을 환영합니다", "Willkommen bei KnowledgeAI",
    ],
    text: [
      "Это ваш личный AI-ассистент по книгам и документам. Покажем за пару шагов, как всё устроено.",
      "Bu sizning kitob va hujjatlar bo'yicha shaxsiy AI-yordamchingiz. Bir necha qadamda hammasini ko'rsatamiz.",
      "Бұл кітаптар мен құжаттар бойынша сіздің жеке AI-көмекшіңіз. Бірнеше қадамда бәрін көрсетеміз.",
      "Це ваш особистий AI-асистент з книг та документів. Покажемо за кілька кроків, як усе влаштовано.",
      "Bu sizin kitab və sənədlər üzrə şəxsi AI-köməkçinizdir. Bir neçə addımda hər şeyi göstərəcəyik.",
      "Бул сиздин китептер жана документтер боюнча жеке AI-жардамчыңыз. Бир нече кадамда баарын көрсөтөбүз.",
      "Ин ёрдамчии шахсии AI-и шумо оид ба китобҳо ва ҳуҷҷатҳост. Дар якчанд қадам ҳамаашро нишон медиҳем.",
      "Гэта ваш асабісты AI-асістэнт па кнігах і дакументах. Пакажам за некалькі крокаў, як усё ўладкавана.",
      "Սա ձեր անհատական AI-օգնականն է գրքերի և փաստաթղթերի համար։ Մի քանի քայլով ցույց կտանք, ինչպես է ամեն ինչ աշխատում։",
      "ეს არის თქვენი პერსონალური AI-ასისტენტი წიგნებისა და დოკუმენტებისთვის. რამდენიმე ნაბიჯში გაჩვენებთ, როგორ მუშაობს ყველაფერი.",
      "Bu siziň kitaplar we resminamalar boýunça şahsy AI-kömekçiňiz. Birnäçe ädimde hemmesini görkezeris.",
      "This is your personal AI assistant for books and documents. We'll show you how it all works in a few steps.",
      "Este es tu asistente de IA personal para libros y documentos. Te mostraremos cómo funciona todo en pocos pasos.",
      "Este é seu assistente de IA pessoal para livros e documentos. Vamos mostrar como tudo funciona em poucos passos.",
      "هذا هو مساعدك الشخصي بالذكاء الاصطناعي للكتب والمستندات. سنوضح لك كيف يعمل كل شيء في خطوات قليلة.",
      "Bu, kitaplar ve belgeler için kişisel AI asistanınız. Birkaç adımda her şeyin nasıl çalıştığını göstereceğiz.",
      "यह किताबों और दस्तावेज़ों के लिए आपका व्यक्तिगत AI सहायक है। हम कुछ चरणों में बताएंगे कि यह कैसे काम करता है।",
      "これはあなたの本や文書のためのパーソナルAIアシスタントです。数ステップで仕組みをご案内します。",
      "이것은 책과 문서를 위한 개인 AI 어시스턴트입니다. 몇 단계로 작동 방식을 보여드리겠습니다.",
      "Dies ist Ihr persönlicher KI-Assistent für Bücher und Dokumente. Wir zeigen Ihnen in wenigen Schritten, wie alles funktioniert.",
    ],
  },
  {
    icon: BookOpen,
    color: "#0ea5e9",
    title: [
      "Создайте раздел", "Bo'lim yarating", "Бөлім құрыңыз", "Створіть розділ", "Bölmə yaradın", "Бөлүм түзүңүз", "Бахш созед", "Стварыце раздзел", "Ստեղծեք բաժին", "შექმენით განყოფილება", "Bölüm dörediň", "Create a section", "Crea una sección", "Crie uma seção", "أنشئ قسماً", "Bir bölüm oluşturun", "एक अनुभाग बनाएं", "セクションを作成", "섹션을 만드세요", "Erstellen Sie einen Bereich",
    ],
    text: [
      "Раздел — это папка для документов на одну тему: книга, курс, кодекс. Начните с кнопки «Новый раздел» на главном экране.",
      "Bo'lim — bitta mavzudagi hujjatlar uchun papka: kitob, kurs, kodeks. Bosh ekrandagi «Yangi bo'lim» tugmasidan boshlang.",
      "Бөлім — бір тақырыпқа арналған құжаттар папкасы: кітап, курс, кодекс. Басты экрандағы «Жаңа бөлім» түймесінен бастаңыз.",
      "Розділ — це папка для документів на одну тему: книга, курс, кодекс. Почніть із кнопки «Новий розділ» на головному екрані.",
      "Bölmə — bir mövzu üzrə sənədlər üçün qovluqdur: kitab, kurs, məcəllə. Əsas ekrandakı «Yeni bölmə» düyməsindən başlayın.",
      "Бөлүм — бир теманын документтери үчүн папка: китеп, курс, кодекс. Башкы экрандагы «Жаңы бөлүм» баскычынан баштаңыз.",
      "Бахш — папка барои ҳуҷҷатҳо оид ба як мавзӯъ: китоб, курс, кодекс. Аз тугмаи «Бахши нав» дар экрани асосӣ оғоз кунед.",
      "Раздзел — гэта папка для дакументаў на адну тэму: кніга, курс, кодэкс. Пачніце з кнопкі «Новы раздзел» на галоўным экране.",
      "Բաժինը մեկ թեմայի փաստաթղթերի պանակ է՝ գիրք, դասընթաց, օրենսգիրք։ Սկսեք գլխավոր էկրանի «Նոր բաժին» կոճակից։",
      "განყოფილება — ეს არის ერთი თემის დოკუმენტების საქაღალდე: წიგნი, კურსი, კოდექსი. დაიწყეთ მთავარ ეკრანზე „ახალი განყოფილება“ ღილაკით.",
      "Bölüm — bir tema boýunça resminamalar üçin bukja: kitap, kurs, kodeks. Baş ekrandaky «Täze bölüm» düwmesinden başlaň.",
      "A section is a folder for documents on one topic: a book, a course, a code. Start with the \"New section\" button on the home screen.",
      "Una sección es una carpeta para documentos sobre un tema: un libro, un curso, un código. Empieza con el botón «Nueva sección» en la pantalla principal.",
      "Uma seção é uma pasta para documentos sobre um tema: um livro, um curso, um código. Comece pelo botão «Nova seção» na tela principal.",
      "القسم هو مجلد للمستندات حول موضوع واحد: كتاب، دورة، قانون. ابدأ بزر «قسم جديد» في الشاشة الرئيسية.",
      "Bölüm, tek bir konudaki belgeler için bir klasördür: bir kitap, bir kurs, bir kanun. Ana ekrandaki «Yeni bölüm» düğmesiyle başlayın.",
      "अनुभाग एक विषय के दस्तावेज़ों के लिए फ़ोल्डर है: किताब, कोर्स, कानून। होम स्क्रीन पर «नया अनुभाग» बटन से शुरू करें।",
      "セクションは1つのテーマに関する文書のフォルダです：本、コース、法典など。ホーム画面の「新規セクション」ボタンから始めましょう。",
      "섹션은 하나의 주제에 대한 문서 폴더입니다: 책, 강좌, 법전 등. 홈 화면의 '새 섹션' 버튼으로 시작하세요.",
      "Ein Bereich ist ein Ordner für Dokumente zu einem Thema: ein Buch, ein Kurs, ein Gesetzbuch. Beginnen Sie mit der Schaltfläche „Neuer Bereich“ auf dem Startbildschirm.",
    ],
  },
  {
    icon: UploadCloud,
    color: "#10b981",
    title: [
      "Загрузите документы", "Hujjatlarni yuklang", "Құжаттарды жүктеңіз", "Завантажте документи", "Sənədləri yükləyin", "Документтерди жүктөңүз", "Ҳуҷҷатҳоро бор кунед", "Загрузіце дакументы", "Վերբեռնեք փաստաթղթերը", "ატვირთეთ დოკუმენტები", "Resminamalary ýükläň", "Upload your documents", "Sube tus documentos", "Envie seus documentos", "ارفع مستنداتك", "Belgelerinizi yükleyin", "अपने दस्तावेज़ अपलोड करें", "文書をアップロード", "문서를 업로드하세요", "Laden Sie Ihre Dokumente hoch",
    ],
    text: [
      "Внутри раздела загружайте PDF, DOCX или ссылку на страницу/видео — AI сам прочитает и обработает материал.",
      "Bo'lim ichida PDF, DOCX yoki sahifa/video havolasini yuklang — AI materialni o'zi o'qib, qayta ishlaydi.",
      "Бөлім ішінде PDF, DOCX немесе бет/бейне сілтемесін жүктеңіз — AI материалды өзі оқып, өңдейді.",
      "Усередині розділу завантажуйте PDF, DOCX або посилання на сторінку/відео — AI сам прочитає й обробить матеріал.",
      "Bölmə daxilində PDF, DOCX və ya səhifə/video linki yükləyin — AI materialı özü oxuyub emal edəcək.",
      "Бөлүмдүн ичинде PDF, DOCX же барак/видео шилтемесин жүктөңүз — AI материалды өзү окуп, иштетет.",
      "Дар дохили бахш PDF, DOCX ё истиноди саҳифа/видеоро бор кунед — AI маводро худаш мехонад ва коркард мекунад.",
      "Унутры раздзела загружайце PDF, DOCX або спасылку на старонку/відэа — AI сам прачытае і апрацуе матэрыял.",
      "Բաժնի ներսում վերբեռնեք PDF, DOCX կամ էջի/տեսանյութի հղում — AI-ն ինքն է կարդալու և մշակելու նյութը։",
      "განყოფილების შიგნით ატვირთეთ PDF, DOCX ან გვერდის/ვიდეოს ბმული — AI თავად წაიკითხავს და დაამუშავებს მასალას.",
      "Bölümiň içinde PDF, DOCX ýa-da sahypa/wideo salgysyny ýükläň — AI materialy özi okap işlär.",
      "Inside a section, upload a PDF, DOCX, or a link to a page/video — the AI will read and process the material itself.",
      "Dentro de una sección, sube un PDF, DOCX o un enlace a una página/video — la IA leerá y procesará el material por sí sola.",
      "Dentro de uma seção, envie um PDF, DOCX ou um link para uma página/vídeo — a IA lerá e processará o material sozinha.",
      "داخل القسم، ارفع ملف PDF أو DOCX أو رابط صفحة/فيديو — سيقرأ الذكاء الاصطناعي المادة ويعالجها بنفسه.",
      "Bölüm içinde bir PDF, DOCX veya bir sayfa/video bağlantısı yükleyin — yapay zeka materyali kendisi okuyup işleyecek.",
      "अनुभाग के अंदर PDF, DOCX या पेज/वीडियो लिंक अपलोड करें — AI खुद सामग्री पढ़ेगा और प्रोसेस करेगा।",
      "セクション内でPDF、DOCX、またはページ/動画のリンクをアップロードすると、AIが自動的に読み取り処理します。",
      "섹션 내에서 PDF, DOCX 또는 페이지/동영상 링크를 업로드하면 AI가 직접 자료를 읽고 처리합니다.",
      "Laden Sie innerhalb eines Bereichs ein PDF, DOCX oder einen Link zu einer Seite/einem Video hoch — die KI liest und verarbeitet das Material selbst.",
    ],
  },
  {
    icon: MessageSquare,
    color: "#f59e0b",
    title: [
      "Задавайте вопросы в чате", "Chatda savol bering", "Чатта сұрақ қойыңыз", "Ставте запитання в чаті", "Söhbətdə sual verin", "Чатта суроо бериңиз", "Дар чат савол диҳед", "Задавайце пытанні ў чаце", "Հարցեր տվեք չաթում", "დასვით კითხვები ჩატში", "Söhbetde sorag beriň", "Ask questions in chat", "Haz preguntas en el chat", "Faça perguntas no chat", "اطرح الأسئلة في المحادثة", "Sohbette soru sorun", "चैट में सवाल पूछें", "チャットで質問する", "채팅에서 질문하세요", "Stellen Sie Fragen im Chat",
    ],
    text: [
      "Откройте «Чат» и спрашивайте что угодно по загруженным материалам — ответы будут со ссылкой на точную страницу источника.",
      "«Chat»ni oching va yuklangan materiallar bo'yicha xohlagan savolingizni bering — javoblar manbaning aniq sahifasiga havola bilan bo'ladi.",
      "«Чатты» ашып, жүктелген материалдар бойынша кез келген сұрақ қойыңыз — жауаптар дереккөздің дәл бетіне сілтемемен болады.",
      "Відкрийте «Чат» і запитуйте про що завгодно щодо завантажених матеріалів — відповіді будуть із посиланням на точну сторінку джерела.",
      "«Söhbət»i açın və yüklənmiş materiallar üzrə istənilən sualı verin — cavablar mənbənin dəqiq səhifəsinə istinadla olacaq.",
      "«Чатты» ачып, жүктөлгөн материалдар боюнча каалаган суроону бериңиз — жооптор булактын так барагына шилтеме менен болот.",
      "«Чат»-ро кушоед ва оид ба маводи борканда ҳар гуна саволе диҳед — ҷавобҳо бо истиноди саҳифаи дурусти манбаъ хоҳанд буд.",
      "Адкрыйце «Чат» і пытайце пра што заўгодна па загружаных матэрыялах — адказы будуць са спасылкай на дакладную старонку крыніцы.",
      "Բացեք «Չաթը» և հարցրեք ցանկացած բան վերբեռնված նյութերի մասին — պատասխանները կլինեն աղբյուրի ճշգրիտ էջի հղումով։",
      "გახსენით „ჩატი“ და დასვით ნებისმიერი კითხვა ატვირთულ მასალებზე — პასუხები იქნება წყაროს ზუსტი გვერდის ბმულით.",
      "«Söhbet»i açyň we ýüklenen materiallar boýunça islendik soragy beriň — jogaplar çeşmäniň takyk sahypasyna salgy bilen bolar.",
      "Open \"Chat\" and ask anything about the uploaded materials — answers will link to the exact source page.",
      "Abre el «Chat» y pregunta lo que quieras sobre los materiales subidos — las respuestas enlazarán a la página exacta de la fuente.",
      "Abra o «Chat» e pergunte o que quiser sobre os materiais enviados — as respostas terão link para a página exata da fonte.",
      "افتح «المحادثة» واسأل عن أي شيء يتعلق بالمواد المرفوعة — ستكون الإجابات مع رابط للصفحة الدقيقة من المصدر.",
      "«Sohbet»i açın ve yüklenen materyaller hakkında istediğinizi sorun — yanıtlar kaynağın tam sayfasına bağlantı içerecek.",
      "«चैट» खोलें और अपलोड की गई सामग्री के बारे में कुछ भी पूछें — जवाब स्रोत के सटीक पेज के लिंक के साथ होंगे।",
      "「チャット」を開いて、アップロードした資料について何でも質問してください — 回答には出典の正確なページへのリンクが付きます。",
      "'채팅'을 열고 업로드된 자료에 대해 무엇이든 질문하세요 — 답변에는 정확한 출처 페이지 링크가 포함됩니다.",
      "Öffnen Sie den „Chat“ und stellen Sie beliebige Fragen zu den hochgeladenen Materialien — die Antworten verlinken auf die genaue Quellseite.",
    ],
  },
  {
    icon: ListChecks,
    color: "#ef4444",
    title: [
      "Проверьте себя тестом", "O'zingizni test bilan tekshiring", "Өзіңізді тестпен тексеріңіз", "Перевірте себе тестом", "Özünüzü testlə yoxlayın", "Өзүңүздү тест менен текшериңиз", "Худро бо тест санҷед", "Праверце сябе тэстам", "Ստուգեք ինքներդ ձեզ թեստով", "შეამოწმეთ საკუთარი თავი ტესტით", "Özüňizi test bilen barlaň", "Test yourself", "Ponte a prueba con un test", "Teste seus conhecimentos", "اختبر نفسك", "Kendinizi testle sınayın", "खुद को टेस्ट से जांचें", "テストで確認しよう", "테스트로 확인해보세요", "Testen Sie sich selbst",
    ],
    text: [
      "Нажмите «Тест» рядом с документом — AI составит вопросы по материалу и проверит ваши ответы.",
      "Hujjat yonidagi «Test» tugmasini bosing — AI material bo'yicha savollar tuzadi va javoblaringizni tekshiradi.",
      "Құжаттың жанындағы «Тест» түймесін басыңыз — AI материал бойынша сұрақтар құрастырып, жауаптарыңызды тексереді.",
      "Натисніть «Тест» біля документа — AI складе запитання за матеріалом і перевірить ваші відповіді.",
      "Sənədin yanındakı «Test» düyməsini basın — AI material üzrə suallar tərtib edəcək və cavablarınızı yoxlayacaq.",
      "Документтин жанындагы «Тест» баскычын басыңыз — AI материал боюнча суроолорду түзөт жана жоопторуңузду текшерет.",
      "Тугмаи «Тест»-ро дар паҳлӯи ҳуҷҷат зер кунед — AI аз рӯи мавод саволҳо тартиб медиҳад ва ҷавобҳои шуморо санҷида мебарояд.",
      "Націсніце «Тэст» побач з дакументам — AI складзе пытанні па матэрыяле і праверыць вашы адказы.",
      "Սեղմեք «Թեստ» կոճակը փաստաթղթի կողքին — AI-ն կկազմի հարցեր նյութի հիման վրա և կստուգի ձեր պատասխանները։",
      "დააჭირეთ „ტესტს“ დოკუმენტის გვერდით — AI შეადგენს კითხვებს მასალის მიხედვით და შეამოწმებს თქვენს პასუხებს.",
      "Resminamanyň ýanyndaky «Test» düwmesine basyň — AI material boýunça soraglar düzer we jogaplaryňyzy barlar.",
      "Click \"Test\" next to a document — the AI will build questions from the material and check your answers.",
      "Haz clic en «Test» junto al documento — la IA elaborará preguntas sobre el material y revisará tus respuestas.",
      "Clique em «Teste» ao lado do documento — a IA elaborará perguntas sobre o material e verificará suas respostas.",
      "انقر على «اختبار» بجانب المستند — سيقوم الذكاء الاصطناعي بإعداد أسئلة حول المادة والتحقق من إجاباتك.",
      "Belgenin yanındaki «Test» düğmesine tıklayın — yapay zeka materyalden sorular hazırlayacak ve yanıtlarınızı kontrol edecek.",
      "दस्तावेज़ के बगल में «टेस्ट» पर क्लिक करें — AI सामग्री से प्रश्न बनाएगा और आपके उत्तर जांचेगा।",
      "文書の横にある「テスト」をクリックすると、AIが資料から問題を作成し、あなたの回答を確認します。",
      "문서 옆의 '테스트'를 클릭하세요 — AI가 자료를 기반으로 질문을 만들고 답변을 확인합니다.",
      "Klicken Sie neben einem Dokument auf „Test“ — die KI erstellt Fragen aus dem Material und überprüft Ihre Antworten.",
    ],
  },
  {
    icon: FileText,
    color: "#a855f7",
    title: [
      "Заполняйте шаблоны документов", "Hujjat shablonlarini to'ldiring", "Құжат үлгілерін толтырыңыз", "Заповнюйте шаблони документів", "Sənəd şablonlarını doldurun", "Документ шаблондорун толтуруңуз", "Андозаҳои ҳуҷҷатро пур кунед", "Запаўняйце шаблоны дакументаў", "Լրացրեք փաստաթղթերի ձևանմուշները", "შეავსეთ დოკუმენტების შაბლონები", "Resminama şablonlaryny dolduryň", "Fill out document templates", "Completa plantillas de documentos", "Preencha modelos de documentos", "املأ قوالب المستندات", "Belge şablonlarını doldurun", "दस्तावेज़ टेम्पलेट्स भरें", "文書テンプレートに入力", "문서 템플릿을 작성하세요", "Füllen Sie Dokumentvorlagen aus",
    ],
    text: [
      "В разделе «Шаблоны» загрузите бланк договора или анкеты, опишите что вставить — получите готовый PDF с сохранённым оформлением.",
      "«Shablonlar» bo'limida shartnoma yoki anketa blankini yuklang, nima kiritish kerakligini yozing — tayyor formatlangan PDF oling.",
      "«Үлгілер» бөлімінде келісімшарт немесе анкета бланкісін жүктеп, нені кірістіру керегін жазыңыз — форматы сақталған дайын PDF аласыз.",
      "У розділі «Шаблони» завантажте бланк договору чи анкети, опишіть що вставити — отримайте готовий PDF зі збереженим оформленням.",
      "«Şablonlar» bölməsində müqavilə və ya anket blankı yükləyin, nə əlavə etmək lazım olduğunu yazın — dizaynı qorunmuş hazır PDF alın.",
      "«Шаблондор» бөлүмүндө келишим же анкета бланкын жүктөңүз, эмнени коюу керектигин жазыңыз — форматы сакталган даяр PDF аласыз.",
      "Дар бахши «Андозаҳо» бланки шартнома ё анкетаро бор кунед, нависед чиро ворид кардан лозим аст — PDF-и тайёр бо тарҳбандии нигоҳдошташуда гиред.",
      "У раздзеле «Шаблоны» загрузіце бланк дагавора ці анкеты, апішыце што ўставіць — атрымайце гатовы PDF з захаваным афармленнем.",
      "«Ձևանմուշներ» բաժնում վերբեռնեք պայմանագրի կամ հարցաթերթիկի ձևաթուղթը, նկարագրեք ինչ տեղադրել — ստացեք պատրաստի PDF՝ պահպանված ձևավորմամբ։",
      "„შაბლონების“ განყოფილებაში ატვირთეთ ხელშეკრულების ან კითხვარის ბლანკი, აღწერეთ რა უნდა ჩასვათ — მიიღეთ მზა PDF შენარჩუნებული დიზაინით.",
      "«Şablonlar» bölüminde şertnama ýa-da anketa blankyny ýükläň, näme goşmalydygyny ýazyň — dizaýny saklanan taýýar PDF alyň.",
      "In \"Templates\", upload a contract or form template, describe what to insert — get a ready PDF with the original formatting preserved.",
      "En «Plantillas», sube un modelo de contrato o formulario, describe qué insertar — obtén un PDF listo con el formato conservado.",
      "Em «Modelos», envie um modelo de contrato ou formulário, descreva o que inserir — receba um PDF pronto com a formatação preservada.",
      "في «القوالب»، ارفع نموذج عقد أو استمارة، وصف ما تريد إدراجه — واحصل على PDF جاهز مع الحفاظ على التنسيق الأصلي.",
      "«Şablonlar»da bir sözleşme veya form şablonu yükleyin, neyin ekleneceğini yazın — orijinal biçimlendirmesi korunmuş hazır bir PDF alın.",
      "«टेम्पलेट्स» में एक अनुबंध या फ़ॉर्म टेम्पलेट अपलोड करें, बताएं क्या डालना है — मूल फ़ॉर्मेटिंग के साथ तैयार PDF पाएं।",
      "「テンプレート」で契約書やフォームのテンプレートをアップロードし、挿入内容を記入すると、元の書式を保ったPDFが完成します。",
      "'템플릿'에서 계약서나 양식 템플릿을 업로드하고 삽입할 내용을 설명하면, 원본 서식이 유지된 완성 PDF를 받습니다.",
      "Laden Sie unter „Vorlagen“ eine Vertrags- oder Formularvorlage hoch, beschreiben Sie, was eingefügt werden soll — erhalten Sie ein fertiges PDF mit erhaltener Formatierung.",
    ],
  },
];

export function OnboardingTutorial({ onDone }: { onDone: () => void }) {
  const { lang } = useLang();
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: "440px", borderRadius: "24px", padding: "32px 28px 28px", background: "var(--color-card)", border: "1px solid var(--color-card-border)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
        <button
          onClick={onDone}
          aria-label={translateClose(lang)}
          style={{ position: "absolute", top: "16px", right: "16px", color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          <X size={20} />
        </button>

        <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: `${current.color}1c`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
          <Icon size={26} style={{ color: current.color }} />
        </div>

        <h2 style={{ fontSize: "19px", fontWeight: 700, color: "var(--color-foreground)", marginBottom: "10px" }}>
          {pick(lang, current.title)}
        </h2>
        <p style={{ fontSize: "14px", lineHeight: 1.55, color: "var(--color-muted)", marginBottom: "24px" }}>
          {pick(lang, current.text)}
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "24px" }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? "20px" : "6px",
                height: "6px",
                borderRadius: "3px",
                transition: "all 0.2s",
                background: i === step ? "var(--color-primary)" : "var(--color-card-border)",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "12px 16px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", cursor: "pointer", background: "var(--color-background)", border: "1px solid var(--color-card-border)", color: "var(--color-foreground)" }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <button
            onClick={() => (isLast ? onDone() : setStep((s) => s + 1))}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", borderRadius: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer", background: "var(--color-primary)", color: "white", border: "none" }}
          >
            {isLast ? translateStart(lang) : translateNext(lang)}
            {!isLast && <ArrowRight size={16} />}
          </button>
        </div>

        {!isLast && (
          <button
            onClick={onDone}
            style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "var(--color-muted)", textDecoration: "underline" }}
          >
            {translateSkip(lang)}
          </button>
        )}
      </div>
    </div>
  );
}

// Small local strings kept as plain 20-slot arrays (same LANGS order) rather
// than routed through translate()'s Russian-keyed dict — they're specific to
// this component and not reused elsewhere.
const CLOSE = ["Закрыть", "Yopish", "Жабу", "Закрити", "Bağla", "Жабуу", "Пӯшидан", "Закрыць", "Փակել", "დახურვა", "Ýapmak", "Close", "Cerrar", "Fechar", "إغلاق", "Kapat", "बंद करें", "閉じる", "닫기", "Schließen"] as const;
const NEXT = ["Далее", "Keyingisi", "Келесі", "Далі", "Növbəti", "Кийинки", "Баъдӣ", "Далей", "Հաջորդը", "შემდეგი", "Indiki", "Next", "Siguiente", "Próximo", "التالي", "İleri", "अगला", "次へ", "다음", "Weiter"] as const;
const START = ["Начать пользоваться", "Boshlash", "Бастау", "Почати", "Başla", "Баштоо", "Оғоз кардан", "Пачаць", "Սկսել", "დაწყება", "Başlamak", "Get started", "Empezar", "Começar", "ابدأ", "Başla", "शुरू करें", "始める", "시작하기", "Loslegen"] as const;
const SKIP = ["Пропустить", "O'tkazib yuborish", "Өткізіп жіберу", "Пропустити", "Buraxmaq", "Өткөрүп жиберүү", "Гузаштан", "Прапусціць", "Բաց թողնել", "გამოტოვება", "Geçirmek", "Skip", "Omitir", "Pular", "تخطي", "Atla", "छोड़ें", "スキップ", "건너뛰기", "Überspringen"] as const;

function translateClose(lang: Parameters<typeof pick>[0]) { return pick(lang, CLOSE); }
function translateNext(lang: Parameters<typeof pick>[0]) { return pick(lang, NEXT); }
function translateStart(lang: Parameters<typeof pick>[0]) { return pick(lang, START); }
function translateSkip(lang: Parameters<typeof pick>[0]) { return pick(lang, SKIP); }
