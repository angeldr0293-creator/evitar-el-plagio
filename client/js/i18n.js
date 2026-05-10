(function () {
  const STORAGE_KEY = "oa_language";
  const DEFAULT_LANGUAGE = "es";
  const SUPPORTED_LANGUAGES = ["es", "en"];

  const dictionary = {
    "ZeroCopy IA": "Academic Originality",
    "ZeroCopy IA": "Academic Originality",
    "Escribe con integridad. Destaca con originalidad.": "Write with integrity. Stand out with originality.",
    "Tu espacio privado de revisión.": "Your private review space.",
    "Panel personalizado del estudiante": "Personalized student dashboard",
    "Panel privado de administración": "Private administration dashboard",
    "Panel del profesor": "Teacher dashboard",
    "Qué hacemos": "What we do",
    "Qu&eacute; hacemos": "What we do",
    "Cómo ayudamos": "How we help",
    "C&oacute;mo ayudamos": "How we help",
    "Precios": "Pricing",
    "Soporte": "Support",
    "Preguntas frecuentes": "FAQ",
    "Mi panel": "My dashboard",
    "Iniciar sesión / Registrarse": "Log in / Sign up",
    "Cerrar sesión": "Log out",
    "Solicitar revisión": "Request review",
    "Solicitar revisi&oacute;n": "Request review",
    "Apoyo para estudiantes": "Student support",
    "Humanizamos tus trabajos y reducimos el plagio": "We make your papers sound natural and reduce plagiarism risk",
    "con ética y calidad": "with integrity and quality",
    "Transformamos textos con alta similitud o generados por IA en contenidos más originales, claros y naturales, manteniendo tu mensaje y mejorando su impacto académico.": "We transform highly similar or AI-generated drafts into clearer, more original, and more natural academic writing while preserving your message and strengthening its impact.",
    "Ver lo que hacemos": "See what we do",
    "Confidencialidad": "Confidentiality",
    "Tu información está 100% protegida.": "Your information is 100% protected.",
    "Calidad garantizada": "Quality you can trust",
    "Textos naturales, coherentes y más originales.": "Natural, coherent, and more original writing.",
    "Entrega puntual": "On-time delivery",
    "Cumplimos los tiempos acordados.": "We meet the agreed deadlines.",
    "Esta página puede ayudarte a:": "This page can help you:",
    "Detectar y reducir frases copiadas, repetitivas o con alta similitud.": "Identify and reduce copied, repetitive, or highly similar wording.",
    "Humanizar textos que suenan artificiales o generados por IA.": "Make artificial or AI-generated text sound more natural.",
    "Reescribir ideas sin perder el sentido original del estudiante.": "Rewrite ideas without losing the student's original meaning.",
    "Revisar citas y referencias para respaldar mejor el contenido.": "Review citations and references so the content is better supported.",
    "Enfocados en la integridad académica y el éxito de los estudiantes.": "Focused on academic integrity and student success.",
    "Confían en nuestro trabajo": "Trusted by students",
    "Estudiantes ayudados": "Students supported",
    "Trabajos revisados": "Papers reviewed",
    "Calificación promedio": "Average rating",
    "Clientes satisfechos": "Satisfied clients",
    "Qué hacemos por los estudiantes": "What we do for students",
    "Ayudamos con dos problemas comunes: el plagio por copiar y pegar, y los textos que parecen escritos por IA porque se sienten fríos, genéricos o poco naturales.": "We help with two common problems: copy-and-paste plagiarism and AI-like writing that feels cold, generic, or unnatural.",
    "Revisión de similitud": "Similarity review",
    "Identificamos fragmentos que parecen copiados, repetidos o demasiado parecidos a otras fuentes para saber qué partes necesitan reescritura o citas.": "We identify passages that appear copied, repeated, or too close to other sources so you know what needs rewriting or citation.",
    "Humanización de texto con IA": "AI-text humanization",
    "Trabajamos textos que suenan automáticos, planos o genéricos para darles una voz más natural, coherente y cercana al estilo del estudiante.": "We revise writing that sounds automatic, flat, or generic so it reads more naturally, coherently, and closer to the student's own style.",
    "Mejora de redacción": "Writing improvement",
    "Reformulamos ideas, ajustamos frases confusas y hacemos que el texto se lea más humano, académico y fácil de entender.": "We reformulate ideas, clarify confusing sentences, and make the writing more natural, academic, and easy to understand.",
    "Ver sitio": "View site",
    "Abrir menú": "Open menu",
    "Cerrar menú": "Close menu",
    "Clientes y suscripciones": "Clients and subscriptions",
    "Vista privada organizada por cliente para revisar plan activo, vencimiento, historial de suscripciones y trabajos enviados.": "Private view organized by client to review active plan, expiration, subscription history, and submitted work.",
    "Clientes registrados": "Registered clients",
    "Clientes activos": "Active clients",
    "Suscripciones": "Subscriptions",
    "Trabajos enviados": "Submitted work",
    "Clientes": "Clients",
    "Trabajos": "Work",
    "Profesores": "Teachers",
    "Carpetas de clientes": "Client folders",
    "Cada carpeta muestra el resumen afuera. Al abrirla ves suscripción, vencimiento, historial y trabajos.": "Each folder shows the summary outside. Open it to see subscription, expiration, history, and work.",
    "Buscar por nombre o correo": "Search by name or email",
    "No hay trabajos pendientes de asignar.": "There is no pending work to assign.",
    "No hay clientes para mostrar": "No clients to show",
    "Crea una cuenta para poder asignarle trabajos desde las carpetas de clientes.": "Create an account so you can assign work from client folders.",
    "Resetear clave": "Reset password",
    "Sin suscripciones guardadas": "No saved subscriptions",
    "Sin plan": "No plan",
    "Activa": "Active",
    "Sin suscripción activa": "No active subscription",
    "Perfil de la persona": "Person profile",
    "Sin profesor fijo": "No assigned teacher",
    "Nuevos trabajos": "New work",
    "Trabajos solicitados": "Requested work",
    "Profesor creado:": "Teacher created:",
    "Credenciales para entregar al profesor:": "Credentials to give the teacher:",
    "Correo:": "Email:",
    "Contraseña:": "Password:",
    "Panel: profesor.html": "Panel: profesor.html",

    "Preparando tu solicitud": "Preparing your request",
    "Estamos revisando si ya tienes una sesión activa.": "We are checking whether you already have an active session.",
    "Solicitud de revisión": "Review request",
    "Envía tu trabajo para humanizarlo y reducir similitud": "Submit your paper for natural rewriting and similarity reduction",
    "Comparte tu archivo y cuéntanos si el texto tiene copy paste, contenido generado por IA, problemas de citas o partes que quieres mejorar.": "Share your file and tell us whether the text has copy-paste, AI-generated content, citation issues, or sections you want improved.",
    "Qué revisamos": "What we review",
    "Similitud, frases copiadas y contenido repetitivo.": "Similarity, copied phrases, and repetitive content.",
    "Texto que suena artificial o generado por IA.": "Text that sounds artificial or AI-generated.",
    "Citas, referencias e instrucciones académicas.": "Citations, references, and academic instructions.",
    "Datos de la solicitud": "Request details",
    "Completa la información principal para entender tu caso y preparar la revisión correcta.": "Complete the main information so we can understand your case and prepare the right review.",
    "Nombre completo": "Full name",
    "Correo electrónico": "Email address",
    "Teléfono o WhatsApp": "Phone",
    "Teléfono": "Phone",
    "Tipo de ayuda": "Type of help",
    "Tipo de documento": "Document type",
    "Formato requerido": "Required format",
    "Fecha límite": "Deadline",
    "Hora de entrega": "Delivery time",
    "Número de trabajos": "Number of papers",
    "Número de páginas": "Number of pages",
    "Instrucciones adicionales": "Additional instructions",
    "Subir archivo": "Upload file",
    "Enviar solicitud": "Submit request",
    "Ej. María González": "e.g., Maria Gonzalez",
    "tu@email.com": "you@email.com",
    "Elige una opción": "Choose an option",
    "Humanizar texto generado por IA": "Humanize AI-generated text",
    "Reducir plagio por copy paste": "Reduce copy-and-paste plagiarism",
    "Reducir similitud o copy paste": "Reduce similarity or copy-paste",
    "Apoyo con citas y referencias": "Help with citations and references",
    "Revisión integral": "Full review",
    "Ensayo": "Essay",
    "Informe": "Report",
    "Tesis": "Thesis",
    "Artículo": "Article",
    "Otro": "Other",

    "Pago seguro del plan": "Secure plan payment",
    "Confirma tu plan antes de continuar": "Confirm your plan before continuing",
    "Revisa los beneficios incluidos, completa los datos de pago y luego continúa con tu solicitud.": "Review the included benefits, complete the payment details, and then continue with your request.",
    "Plan seleccionado": "Selected plan",
    "Estos son los beneficios incluidos en tu paquete.": "These are the benefits included in your package.",
    "Precio": "Price",
    "Trabajos": "Papers",
    "Páginas": "Pages",
    "P&aacute;ginas": "Pages",
    "Beneficios incluidos": "Included benefits",
    "Datos para realizar el pago": "Payment details",
    "Esta pantalla deja listo el flujo visual de pago. Cuando conectes una pasarela real, estos campos pueden enviarse al proveedor de pagos.": "This screen prepares the visual payment flow. When you connect a real gateway, these fields can be sent to the payment provider.",
    "Métodos de pago": "Payment methods",
    "M&eacute;todos de pago": "Payment methods",
    "Nombre en la tarjeta": "Name on card",
    "Número de tarjeta": "Card number",
    "Fecha de vencimiento": "Expiration date",
    "Código de seguridad": "Security code",
    "Confirmar pago": "Confirm payment",
    "Continuar": "Continue",

    "Paquetes y créditos": "Packages and credits",
    "Planes de revisión": "Review plans",
    "Precios según tu necesidad": "Pricing that fits your needs",
    "Elige el nivel de ayuda que necesitas para reducir similitud, humanizar textos con IA y mejorar la redacción de tu documento académico.": "Choose the level of support you need to reduce similarity, revise AI-generated writing, and improve the style of your academic document.",
    "Elige el plan que mejor se ajusta a tu volumen de trabajos y páginas.": "Choose the plan that best fits your amount of papers and pages.",
    "Paquete Inicial": "Starter Package",
    "Paquete Académico": "Academic Package",
    "Paquete Premium": "Premium Package",
    "Ideal para estudiantes que necesitan revisar varios trabajos cortos con una intervención clara y cuidada.": "Ideal for students who need several short papers reviewed with clear, careful editing.",
    "Ideal para una revisión puntual de un trabajo corto o una entrega específica.": "Ideal for a focused review of a short paper or a specific submission.",
    "La opción más equilibrada para trabajos más largos que necesitan humanización y reducción de similitud.": "The most balanced option for longer papers that need natural rewriting and similarity reduction.",
    "Pensado para estudiantes que necesitan apoyo frecuente durante el mes.": "Designed for students who need frequent support during the month.",
    "Perfecto para quienes manejan más entregas y quieren una solución completa para varios documentos.": "Perfect for those handling more submissions who want a complete solution for several documents.",
    "Uso estimado:": "Estimated use:",
    "Uso estimado: 1 trabajo": "Estimated use: 1 paper",
    "Uso estimado: 5 trabajos": "Estimated use: 5 papers",
    "Uso estimado: 10 trabajos": "Estimated use: 10 papers",
    "Referencia:": "Reference:",
    "Referencia: hasta 5 páginas por trabajo": "Reference: up to 5 pages per paper",
    "Referencia: hasta 10 páginas por trabajo": "Reference: up to 10 pages per paper",
    "Revisión de similitud general": "General similarity review",
    "Redacción más clara y natural": "Clearer, more natural writing",
    "Humanización básica del contenido": "Basic content humanization",
    "Entrega estándar": "Standard delivery",
    "Más solicitado": "Most requested",
    "Revisión más detallada de similitud": "More detailed similarity review",
    "Intervención avanzada del contenido": "Advanced content revision",
    "Humanización completa del documento": "Full document humanization",
    "Mejora de coherencia y estructura": "Improved coherence and structure",
    "Créditos incluidos:": "Included credits:",
    "Equivalente a": "Equivalent to",
    "páginas": "pages",
    "página": "page",
    "créditos": "credits",
    "1 página = 2 créditos": "1 page = 2 credits",
    "Puedes enviar más páginas si tus créditos alcanzan.": "You can submit more pages if your credits cover them.",
    "Los créditos no utilizados quedan disponibles para próximos trabajos.": "Unused credits remain available for future work.",
    "Elegir plan": "Choose plan",
    "Evaluación por documento": "Document-by-document assessment",
    "Primero se revisa el archivo para entender qué tan profundo debe ser el trabajo de humanización y reducción de similitud.": "First, the file is reviewed to understand how deep the humanization and similarity reduction work should be.",
    "Opciones flexibles": "Flexible options",
    "Si un trabajo supera la referencia de páginas, puede enviarse mientras tengas créditos suficientes. Entregas urgentes o intervenciones especiales pueden revisarse antes de iniciar.": "If a paper exceeds the page reference, it can be submitted as long as you have enough credits. Urgent deliveries or special interventions can be reviewed before starting.",
    "¿No sabes qué plan elegir?": "Not sure which plan to choose?",
    "Envía tu archivo y revisamos qué nivel de ayuda necesita tu trabajo antes de confirmar el servicio.": "Send your file and we will review what level of help your work needs before confirming the service.",

    "Crear cuenta": "Create account",
    "Iniciar sesión": "Log in",
    "Crea tu cuenta": "Create your account",
    "Crea tu cuenta y administra tus revisiones en un solo lugar": "Create your account and manage your reviews in one place",
    "Tu plataforma personal te permite enviar trabajos, guardar solicitudes, revisar estados y mantener tus archivos organizados.": "Your personal platform lets you submit work, save requests, check status updates, and keep your files organized.",
    "Historial de solicitudes": "Request history",
    "Consulta los trabajos que has enviado y el paquete seleccionado.": "Review the work you have submitted and the selected package.",
    "Seguimiento personalizado": "Personalized tracking",
    "Mira si tu revisión está recibida, en proceso o lista.": "See whether your review has been received, is in progress, or is ready.",
    "Datos guardados": "Saved details",
    "No tienes que escribir tu información cada vez que solicitas una revisión.": "You do not have to enter your information every time you request a review.",
    "Accede a tu cuenta": "Access your account",
    "Nombre": "Name",
    "Correo": "Email",
    "Teléfono": "Phone",
    "Contraseña": "Password",
    "Mínimo 6 caracteres": "Minimum 6 characters",
    "Confirmar contraseña": "Confirm password",
    "Repite tu contraseña": "Repeat your password",
    "Ver": "Show",
    "Ocultar": "Hide",
    "Las contraseñas no coinciden.": "Passwords do not match.",
    "Tu contraseña": "Your password",
    "Ya tengo cuenta": "I already have an account",
    "Crear mi cuenta": "Create my account",
    "Entrar a mi panel": "Go to my dashboard",
    "Cuenta creada correctamente. Redirigiendo...": "Account created successfully. Redirecting...",
    "Sesión iniciada. Redirigiendo...": "Session started. Redirecting...",
    "Entrar": "Enter",
    "Volver al inicio": "Back to home",
    "Tu espacio privado para enviar trabajos, revisar avances y mantener todo organizado.": "Your private space to submit work, review progress, and keep everything organized.",
    "Registro rápido": "Quick registration",
    "Panel privado": "Private dashboard",
    "Historial ordenado": "Organized history",

    "Hola,": "Hello,",
    "Cuenta": "Account",
    "Solicitudes": "Requests",
    "Recibidas": "Received",
    "Último paquete": "Latest package",
    "Créditos disponibles": "Available credits",
    "Enviar trabajo": "Submit work",
    "Comprar créditos": "Buy credits",
    "Nueva solicitud": "New request",
    "Aún no tienes solicitudes": "You do not have requests yet",
    "Cuando envíes tu primer trabajo, aparecerá aquí con su paquete, fecha y estado.": "When you submit your first paper, it will appear here with its package, date, and status.",
    "Enviar mi primer trabajo": "Submit my first paper",
    "Compra un plan para activar tus créditos. 1 página = 2 créditos.": "Buy a plan to activate your credits. 1 page = 2 credits.",
    "Sin créditos activos": "No active credits",
    "disponibles": "available",
    "Paquete:": "Package:",
    "Ayuda:": "Help:",
    "Trabajos:": "Papers:",
    "Créditos invertidos:": "Credits used:",
    "Archivos:": "Files:",
    "Páginas:": "Pages:",
    "Hora de entrega:": "Delivery time:",
    "Documento académico": "Academic document",
    "Recibida": "Received",
    "En proceso": "In progress",
    "Entregada": "Delivered",

    "Panel privado de profesorado": "Private teacher panel",
    "Clientes asignados": "Assigned clients",
    "Sin clientes asignados": "No assigned clients",
    "Cuando administración te asigne trabajos, aquí verás el historial de clientes atendidos.": "When administration assigns work to you, you will see your client history here.",
    "Subir entrega": "Upload delivery",
    "Guardar entrega": "Save delivery",
    "Estado": "Status",
    "Asignar": "Assign",

    "Soluciones académicas con criterio humano": "Academic solutions with human judgment",
    "Humanizamos textos, reducimos similitud y reforzamos citas para que tus trabajos se lean con más claridad, originalidad y responsabilidad.": "We humanize texts, reduce similarity, and strengthen citations so your papers read with more clarity, originality, and responsibility.",
    "Empezar revisión": "Start review",
    "Ver paquetes": "View packages",
    "Textos más naturales": "More natural texts",
    "Menos similitud": "Less similarity",
    "Mejores citas": "Better citations",
    "Servicios principales": "Main services",
    "Humanización de textos": "Text humanization",
    "Reescribimos partes que suenan artificiales para que el trabajo tenga una voz más clara, coherente y académica.": "We rewrite sections that sound artificial so the paper has a clearer, more coherent, academic voice.",
    "Reducción de similitud": "Similarity reduction",
    "Detectamos frases demasiado parecidas a otras fuentes y las trabajamos con redacción original y responsable.": "We detect phrases that are too similar to other sources and rework them with original, responsible wording.",
    "Apoyo con citas": "Citation support",
    "Revisamos si el contenido necesita citas, referencias o ajustes para que las ideas tomadas de otras fuentes estén mejor respaldadas.": "We review whether the content needs citations, references, or adjustments so ideas from other sources are better supported.",
    "Cómo ayudamos paso a paso": "How we help step by step",
    "El objetivo es que recibas una versión más humana, entendible y alineada con buenas prácticas académicas.": "The goal is for you to receive a more human, understandable version aligned with good academic practices.",
    "Recibimos el trabajo": "We receive the work",
    "Compartes tu documento y explicas qué necesitas mejorar.": "You share your document and explain what you need improved.",
    "Analizamos el texto": "We analyze the text",
    "Revisamos similitud, frases copiadas y señales de texto demasiado artificial.": "We review similarity, copied phrases, and signs of overly artificial text.",
    "Humanizamos el contenido": "We humanize the content",
    "Reescribimos y reforzamos la claridad sin borrar la idea principal.": "We rewrite and strengthen clarity without removing the main idea.",
    "Entregamos la revisión": "We deliver the review",
    "Recibes un archivo más natural, revisado y mejor respaldado.": "You receive a more natural, reviewed, and better supported file.",
    "Estas respuestas explican el enfoque del servicio y lo que puede hacer la plataforma por los estudiantes.": "These answers explain the service approach and what the platform can do for students.",
    "¿La página cambia todo el trabajo automáticamente?": "Does the page change the whole paper automatically?",
    "No. La idea es combinar herramientas de apoyo con revisión y criterio humano para mejorar el texto de forma más responsable.": "No. The idea is to combine support tools with review and human judgment to improve the text more responsibly.",
    "¿Pueden humanizar un trabajo hecho con IA?": "Can you humanize a paper made with AI?",
    "Sí. Podemos revisar textos que suenan genéricos o artificiales y trabajarlos para que tengan una redacción más natural, clara y coherente.": "Yes. We can review texts that sound generic or artificial and work on them so they have more natural, clear, coherent wording.",
    "¿También se revisan citas y referencias?": "Do you also review citations and references?",
    "Sí. La plataforma puede ayudar a detectar cuándo una idea necesita citarse mejor o cuándo una referencia debe presentarse con más orden.": "Yes. The platform can help detect when an idea needs better citation or when a reference should be presented more clearly.",
    "Envía tu trabajo para una revisión más humana y original": "Submit your work for a more human and original review",
    "Cuéntanos qué necesitas, comparte tu archivo y revisamos el mejor camino para mejorar tu documento.": "Tell us what you need, share your file, and we will review the best path to improve your document.",
    "Apoyo para textos más humanos, claros y responsables": "Support for more human, clear, and responsible texts",
    "Planes para textos más humanos, claros y responsables": "Plans for more human, clear, and responsible texts"
  };

  const reverseDictionary = Object.entries(dictionary).reduce((result, [es, en]) => {
    result[en] = es;
    return result;
  }, {});

  let currentLanguage = getStoredLanguage();
  let isApplying = false;

  function getStoredLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
  }

  function translateText(value, language = currentLanguage) {
    if (!value || typeof value !== "string") {
      return value;
    }

    const source = language === "en" ? dictionary : reverseDictionary;
    let translated = value;
    const entries = Object.entries(source).sort((a, b) => b[0].length - a[0].length);

    entries.forEach(([from, to]) => {
      if (translated.includes(from)) {
        translated = translated.split(from).join(to);
      }
    });

    return translated;
  }

  function shouldSkipNode(node) {
    const parent = node.parentElement;
    return !parent || parent.closest("script, style, svg, textarea, [data-i18n-ignore]");
  }

  function translateNode(root = document.body) {
    if (!root) {
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return shouldSkipNode(node) || !node.nodeValue.trim()
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((node) => {
      node.nodeValue = translateText(node.nodeValue);
    });

    root.querySelectorAll?.("[placeholder], [aria-label], [title], input[type='submit'], input[type='button']").forEach((element) => {
      ["placeholder", "aria-label", "title", "value"].forEach((attribute) => {
        if (element.hasAttribute(attribute)) {
          element.setAttribute(attribute, translateText(element.getAttribute(attribute)));
        }
      });
    });

    document.title = translateText(document.title);
    document.documentElement.lang = currentLanguage;
  }

  function applyLanguage(language = currentLanguage) {
    currentLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
    localStorage.setItem(STORAGE_KEY, currentLanguage);
    isApplying = true;
    translateNode(document.body);
    updateSwitcher();
    isApplying = false;
    window.dispatchEvent(new CustomEvent("oa:languagechange", { detail: { language: currentLanguage } }));
  }

  function addStyles() {
    if (document.getElementById("oa-i18n-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "oa-i18n-styles";
    style.textContent = `
      .language-switcher {
        align-items: center;
        background: #eef5f3;
        border: 1px solid #d8e5e1;
        border-radius: 999px;
        display: inline-flex;
        gap: 2px;
        padding: 4px;
      }

      .language-switcher button {
        background: transparent;
        border: 0;
        border-radius: 999px;
        color: #475569;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        font-weight: 800;
        min-height: 34px;
        min-width: 42px;
        padding: 7px 10px;
      }

      .language-switcher button.active {
        background: #071832;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  function findSwitcherTarget() {
    return document.querySelector(".language-target")
      || document.querySelector(".nav-tools")
      || document.querySelector(".nav-actions")
      || document.querySelector(".nav-links")
      || document.querySelector(".topbar")
      || document.querySelector(".nav")
      || document.querySelector("header .container")
      || document.body;
  }

  function createSwitcher() {
    if (document.querySelector(".language-switcher")) {
      return;
    }

    addStyles();
    const switcher = document.createElement("div");
    switcher.className = "language-switcher";
    switcher.setAttribute("aria-label", "Idioma");
    switcher.setAttribute("data-i18n-ignore", "true");
    switcher.innerHTML = `
      <button type="button" data-language="es">ES</button>
      <button type="button" data-language="en">EN</button>
    `;

    switcher.addEventListener("click", (event) => {
      const button = event.target.closest("[data-language]");
      if (button) {
        applyLanguage(button.dataset.language);
      }
    });

    findSwitcherTarget().appendChild(switcher);
    updateSwitcher();
  }

  function updateSwitcher() {
    document.querySelectorAll(".language-switcher [data-language]").forEach((button) => {
      const isActive = button.dataset.language === currentLanguage;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function observeChanges() {
    const observer = new MutationObserver((mutations) => {
      if (isApplying || currentLanguage === DEFAULT_LANGUAGE) {
        return;
      }

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            isApplying = true;
            translateNode(node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
            isApplying = false;
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.OAI18N = {
    applyLanguage,
    getLanguage: () => currentLanguage,
    t: translateText
  };

  document.addEventListener("DOMContentLoaded", () => {
    createSwitcher();
    applyLanguage(currentLanguage);
    observeChanges();
  });
})();
