/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package contenti18n

func translations(en, zhCN, zhTW, fr, ja, ru, vi string) map[Locale]string {
	return map[Locale]string{
		LocaleEnglish:            en,
		LocaleSimplifiedChinese:  zhCN,
		LocaleTraditionalChinese: zhTW,
		LocaleFrench:             fr,
		LocaleJapanese:           ja,
		LocaleRussian:            ru,
		LocaleVietnamese:         vi,
	}
}

var faqCatalog = map[string]faqTranslation{
	"1": {
		question: leaf("b849f0e2", translations(
			"What is RelayBases?", "RelayBases 是什么？", "RelayBases 是什麼？",
			"Qu’est-ce que RelayBases ?", "RelayBases とは何ですか？", "Что такое RelayBases?", "RelayBases là gì?",
		)),
		answer: leaf("c81ea506", translations(
			"RelayBases is a <strong>unified AI model gateway</strong> for developers and teams. With one API Key, you can access the GPT, Claude, Gemini, and other models currently listed in the Model Marketplace from Codex, Claude Code, VS Code, Cursor, Chatbox, and similar clients. You do not need to register for multiple platforms or maintain separate credentials; the gateway handles compatible routing and the required <strong>OpenAI ↔ Anthropic protocol conversion</strong>.",
			"RelayBases 是面向开发者和团队的 <strong>AI 模型统一接入网关</strong>。只需一个 API Key，即可在 Codex、Claude Code、VS Code、Cursor、Chatbox 等客户端调用模型广场当前提供的 GPT、Claude、Gemini 等模型，无需分别注册多个平台或维护多套密钥。网关会处理兼容路由与必要的 <strong>OpenAI ↔ Anthropic 协议转换</strong>。",
			"RelayBases 是面向開發者與團隊的<strong>統一 AI 模型閘道</strong>。只需一組 API Key，即可從 Codex、Claude Code、VS Code、Cursor、Chatbox 等用戶端使用模型廣場目前提供的 GPT、Claude、Gemini 等模型，無須分別註冊多個平台或維護多組憑證；閘道會處理相容路由及必要的 <strong>OpenAI ↔ Anthropic 協定轉換</strong>。",
			"RelayBases est une <strong>passerelle unifiée de modèles d’IA</strong> pour les développeurs et les équipes. Une seule clé API permet d’utiliser les modèles GPT, Claude, Gemini et les autres modèles du catalogue depuis Codex, Claude Code, VS Code, Cursor, Chatbox et des clients similaires. La passerelle gère le routage compatible et la conversion de protocole <strong>OpenAI ↔ Anthropic</strong> nécessaire.",
			"RelayBases は、開発者とチーム向けの<strong>統合 AI モデルゲートウェイ</strong>です。1 つの API Key で、Codex、Claude Code、VS Code、Cursor、Chatbox などからモデルマーケットの GPT、Claude、Gemini などを利用できます。複数サービスへの登録や認証情報の個別管理は不要で、互換ルーティングと必要な <strong>OpenAI ↔ Anthropic プロトコル変換</strong>はゲートウェイが処理します。",
			"RelayBases — это <strong>единый шлюз к моделям ИИ</strong> для разработчиков и команд. Один API Key дает доступ из Codex, Claude Code, VS Code, Cursor, Chatbox и похожих клиентов к GPT, Claude, Gemini и другим моделям из каталога. Шлюз выполняет совместимую маршрутизацию и необходимое <strong>преобразование протоколов OpenAI ↔ Anthropic</strong>.",
			"RelayBases là <strong>cổng truy cập mô hình AI hợp nhất</strong> cho nhà phát triển và nhóm. Chỉ với một API Key, bạn có thể dùng GPT, Claude, Gemini và các mô hình hiện có trong Chợ mô hình từ Codex, Claude Code, VS Code, Cursor, Chatbox cùng các ứng dụng tương tự. Cổng xử lý định tuyến tương thích và <strong>chuyển đổi giao thức OpenAI ↔ Anthropic</strong> khi cần.",
		)),
	},
	"3": {
		question: leaf("bdc8f0a0", translations(
			"Is my data secure?", "我的数据安全吗？", "我的資料安全嗎？", "Mes données sont-elles sécurisées ?", "データは安全ですか？", "Безопасны ли мои данные?", "Dữ liệu của tôi có an toàn không?",
		)),
		answer: leaf("74d587a7", translations(
			"API requests are encrypted with <strong>TLS</strong> in transit. The gateway processes content only as needed to complete model requests and does not use API inputs or outputs for model training. Access controls, logging, data handling, and retention are governed by the Privacy Policy and Terms of Service.",
			"API 请求在传输过程中使用 <strong>TLS</strong> 加密。网关仅为完成模型调用而处理中转内容，不将 API 输入或输出用于模型训练。访问控制、日志、数据处理与保留规则以隐私政策和服务条款为准。",
			"API 請求在傳輸過程中使用 <strong>TLS</strong> 加密。閘道僅為完成模型請求而處理內容，不會將 API 輸入或輸出用於模型訓練。存取控制、日誌、資料處理與保留規則以隱私權政策及服務條款為準。",
			"Les requêtes API sont chiffrées en transit avec <strong>TLS</strong>. La passerelle ne traite le contenu que pour exécuter les requêtes et n’utilise ni les entrées ni les sorties API pour entraîner des modèles. Les règles d’accès, de journalisation, de traitement et de conservation figurent dans la Politique de confidentialité et les Conditions d’utilisation.",
			"API リクエストは転送中に <strong>TLS</strong> で暗号化されます。ゲートウェイはモデルリクエストの実行に必要な範囲でのみ内容を処理し、API の入力や出力をモデル学習に使用しません。アクセス制御、ログ、データ処理、保持はプライバシーポリシーと利用規約に従います。",
			"API-запросы шифруются при передаче с помощью <strong>TLS</strong>. Шлюз обрабатывает содержимое только для выполнения запросов к моделям и не использует входные или выходные данные API для обучения. Правила доступа, журналирования, обработки и хранения данных определены Политикой конфиденциальности и Условиями использования.",
			"Yêu cầu API được mã hóa bằng <strong>TLS</strong> khi truyền. Cổng chỉ xử lý nội dung để hoàn tất yêu cầu mô hình và không dùng dữ liệu vào hoặc ra của API để huấn luyện mô hình. Việc kiểm soát truy cập, ghi nhật ký, xử lý và lưu giữ dữ liệu tuân theo Chính sách quyền riêng tư và Điều khoản dịch vụ.",
		)),
	},
	"5": {
		question: leaf("3ee698e7", translations(
			"How do I get an API Key?", "如何获取 API Key？", "如何取得 API Key？", "Comment obtenir une clé API ?", "API Key はどう取得しますか？", "Как получить API Key?", "Làm cách nào để lấy API Key?",
		)),
		answer: leaf("e8cb51f0", translations(
			"Open the <a href=\"https://relaybases.com/keys\" target=\"_blank\" rel=\"noopener noreferrer\">API Keys page in the console</a>, click “Create API Key,” choose an available group, and set a quota if needed. Save, then copy the Key. See the usage documentation for the complete setup steps.",
			"登录<a href=\"https://relaybases.com/keys\" target=\"_blank\" rel=\"noopener noreferrer\">控制台的 API 密钥页面</a>，点击「创建 API 密钥」，选择当前可用分组并按需设置额度。保存后复制 Key 即可；完整步骤可查看使用文档。",
			"開啟<a href=\"https://relaybases.com/keys\" target=\"_blank\" rel=\"noopener noreferrer\">控制台的 API Keys 頁面</a>，點選「建立 API Key」、選擇可用分組並按需設定額度。儲存後複製 Key；完整步驟請參閱使用文件。",
			"Ouvrez la <a href=\"https://relaybases.com/keys\" target=\"_blank\" rel=\"noopener noreferrer\">page des clés API de la console</a>, cliquez sur « Créer une clé API », choisissez un groupe disponible et définissez un quota si nécessaire. Enregistrez puis copiez la clé. Consultez la documentation d’utilisation pour toutes les étapes.",
			"<a href=\"https://relaybases.com/keys\" target=\"_blank\" rel=\"noopener noreferrer\">コンソールの API Keys ページ</a>を開き、「API Key を作成」を押して利用可能なグループを選び、必要なら上限を設定します。保存後に Key をコピーしてください。詳しい手順は利用ドキュメントを参照してください。",
			"Откройте <a href=\"https://relaybases.com/keys\" target=\"_blank\" rel=\"noopener noreferrer\">страницу API Keys в консоли</a>, нажмите «Создать API Key», выберите доступную группу и при необходимости задайте лимит. Сохраните и скопируйте ключ. Полная инструкция приведена в документации.",
			"Mở <a href=\"https://relaybases.com/keys\" target=\"_blank\" rel=\"noopener noreferrer\">trang API Keys trong bảng điều khiển</a>, chọn “Tạo API Key”, chọn nhóm khả dụng và đặt hạn mức nếu cần. Lưu rồi sao chép Key. Xem tài liệu sử dụng để biết đầy đủ các bước.",
		)),
	},
	"6": {
		question: leaf("050fbdd4", translations(
			"Can I use one Key on multiple devices?", "一个 Key 能在多台设备上使用吗？", "一組 Key 能在多台裝置上使用嗎？", "Puis-je utiliser une clé sur plusieurs appareils ?", "1 つの Key を複数端末で使えますか？", "Можно ли использовать один Key на нескольких устройствах?", "Tôi có thể dùng một Key trên nhiều thiết bị không?",
		)),
		answer: leaf("c95a8f4e", translations(
			"<strong>Yes.</strong>One Key can be used across the Codex App, CLI, VS Code extensions, and other clients. Usage is deducted from the same API Credits balance and can be reviewed in the console. For production, create separate Keys per app or device to simplify revocation, limits, and auditing.",
			"<strong>可以。</strong>同一个 Key 可在 Codex App、CLI、VSCode 插件等多个客户端中使用，用量统一从同一 API Credits 余额扣减，控制台可查看明细。生产环境建议按应用或设备分别创建 Key，便于撤销、限额和审计。",
			"<strong>可以。</strong>同一組 Key 可用於 Codex App、CLI、VS Code 擴充套件等多個用戶端；用量會從同一 API Credits 餘額扣除，並可在控制台查看。正式環境建議按應用程式或裝置建立不同 Key，方便撤銷、限額與稽核。",
			"<strong>Oui.</strong> Une même clé peut être utilisée dans Codex App, le CLI, les extensions VS Code et d’autres clients. L’utilisation est débitée du même solde d’API Credits et reste consultable dans la console. En production, créez une clé par application ou appareil pour faciliter la révocation, les limites et l’audit.",
			"<strong>はい。</strong>同じ Key を Codex App、CLI、VS Code 拡張など複数のクライアントで利用できます。使用量は共通の API Credits 残高から差し引かれ、コンソールで確認できます。本番環境では、失効・上限・監査を管理しやすいよう、アプリや端末ごとに Key を分けることを推奨します。",
			"<strong>Да.</strong> Один Key можно использовать в Codex App, CLI, расширениях VS Code и других клиентах. Расход списывается с общего баланса API Credits и отображается в консоли. Для продакшена создавайте отдельный Key для каждого приложения или устройства, чтобы упростить отзыв, лимиты и аудит.",
			"<strong>Có.</strong> Một Key có thể dùng trên Codex App, CLI, tiện ích VS Code và các ứng dụng khác. Mức sử dụng được trừ từ cùng số dư API Credits và có thể xem trong bảng điều khiển. Với môi trường sản xuất, nên tạo Key riêng cho từng ứng dụng hoặc thiết bị để dễ thu hồi, giới hạn và kiểm tra.",
		)),
	},
}

var apiInfoCatalog = map[string]apiInfoTranslation{
	"1": {
		route: leaf("af3852b3", translations(
			"Standard API (Best Compatibility)", "标准 API（兼容性优先）", "標準 API（相容性優先）", "API standard (compatibilité maximale)", "標準 API（互換性優先）", "Стандартный API (лучшая совместимость)", "API tiêu chuẩn (tương thích tốt nhất)",
		)),
		description: leaf("b4298487", translations(
			"Cloudflare-accelerated; long-running synchronous requests may time out.", "经 Cloudflare 加速；长时间同步请求可能超时。", "經 Cloudflare 加速；長時間同步請求可能逾時。", "Accéléré par Cloudflare ; les longues requêtes synchrones peuvent expirer.", "Cloudflare で高速化されています。長時間の同期リクエストはタイムアウトする場合があります。", "Ускоряется Cloudflare; длительные синхронные запросы могут завершиться по тайм-ауту.", "Được tăng tốc qua Cloudflare; yêu cầu đồng bộ chạy lâu có thể hết thời gian chờ.",
		)),
	},
	"2": {
		route: leaf("b2d90022", translations(
			"RelayBases Media API endpoint for image and video tasks.", "RelayBases 媒体 API，供图片与视频任务使用。", "RelayBases 媒體 API，供圖片與影片任務使用。", "Point de terminaison RelayBases Media API pour les tâches d’image et de vidéo.", "画像・動画タスク向け RelayBases Media API エンドポイント。", "Эндпоинт RelayBases Media API для задач с изображениями и видео.", "Điểm cuối RelayBases Media API cho tác vụ hình ảnh và video.",
		)),
		description: leaf("5e7b9936", translations(
			"Dedicated image and video API endpoint", "图片与视频专用 API 地址", "圖片與影片專用 API 位址", "Point de terminaison API dédié aux images et vidéos", "画像・動画専用 API エンドポイント", "Выделенный API-эндпоинт для изображений и видео", "Điểm cuối API riêng cho hình ảnh và video",
		)),
	},
	"3": {
		route: leaf("3af25111", translations(
			"US Direct API (Long Requests)", "美国直连 API（长请求优先）", "美國直連 API（長請求優先）", "API direct États-Unis (requêtes longues)", "米国直結 API（長時間リクエスト向け）", "Прямой API в США (длительные запросы)", "API kết nối trực tiếp tại Mỹ (yêu cầu dài)",
		)),
		description: leaf("9413fcb1", translations(
			"Direct origin connection without Cloudflare proxy timeouts; it may be unreachable from some networks.", "直连源站，不受 Cloudflare 代理超时限制；部分网络环境可能无法访问。", "直連來源站，不受 Cloudflare Proxy 逾時限制；部分網路環境可能無法存取。", "Connexion directe à l’origine, sans délai d’expiration du proxy Cloudflare ; elle peut être inaccessible depuis certains réseaux.", "オリジンへ直接接続するため Cloudflare プロキシのタイムアウトを受けません。一部のネットワークからは到達できない場合があります。", "Прямое подключение к исходному серверу без тайм-аутов прокси Cloudflare; в некоторых сетях оно может быть недоступно.", "Kết nối trực tiếp đến máy chủ gốc, không bị giới hạn thời gian chờ của proxy Cloudflare; một số mạng có thể không truy cập được.",
		)),
	},
}

func groupDescription(sourceHash, en, zhCN, zhTW, fr, ja, ru, vi string) groupTranslation {
	return groupTranslation{description: leaf(sourceHash, translations(en, zhCN, zhTW, fr, ja, ru, vi))}
}

var userGroupCatalog = map[string]groupTranslation{
	"media":           groupDescription("24b0e808", "Image and video generation models.", "图片和视频生成模型。", "圖片與影片生成模型。", "Modèles de génération d’images et de vidéos.", "画像・動画生成モデル。", "Модели генерации изображений и видео.", "Các mô hình tạo hình ảnh và video."),
	"codex-pro":       groupDescription("db5e4883", "Stable GPT Pro pool for production.", "适合生产环境的稳定 GPT Pro 资源池。", "適合正式環境的穩定 GPT Pro 資源池。", "Pool GPT Pro stable pour la production.", "本番向けの安定した GPT Pro プール。", "Стабильный пул GPT Pro для продакшена.", "Nhóm GPT Pro ổn định cho môi trường sản xuất."),
	"claude-max":      groupDescription("9e9d8eb1", "Stable Claude Max route for production.", "适合生产环境的稳定 Claude Max 路由。", "適合正式環境的穩定 Claude Max 路由。", "Route Claude Max stable pour la production.", "本番向けの安定した Claude Max ルート。", "Стабильный маршрут Claude Max для продакшена.", "Tuyến Claude Max ổn định cho môi trường sản xuất."),
	"codex-plus":      groupDescription("a31e18d6", "GPT Plus pool for light use.", "适合轻量使用的 GPT Plus 资源池。", "適合輕量使用的 GPT Plus 資源池。", "Pool GPT Plus pour un usage léger.", "軽量利用向け GPT Plus プール。", "Пул GPT Plus для легких задач.", "Nhóm GPT Plus cho nhu cầu nhẹ."),
	"claude-lite":     groupDescription("157c8674", "Low-cost Claude route for light use.", "适合轻量使用的低成本 Claude 路由。", "適合輕量使用的低成本 Claude 路由。", "Route Claude économique pour un usage léger.", "軽量利用向けの低コスト Claude ルート。", "Недорогой маршрут Claude для легких задач.", "Tuyến Claude chi phí thấp cho nhu cầu nhẹ."),
	"gemini-lite":     groupDescription("b3100645", "Antigravity proxy route.", "Antigravity 代理路由。", "Antigravity Proxy 路由。", "Route proxy Antigravity.", "Antigravity プロキシルート。", "Прокси-маршрут Antigravity.", "Tuyến proxy Antigravity."),
	"open-models":     groupDescription("5fc430ad", "Open-weight models for reasoning and coding.", "用于推理和编程的开放权重模型。", "用於推理與程式設計的開放權重模型。", "Modèles à poids ouverts pour le raisonnement et le code.", "推論・コーディング向けのオープンウェイトモデル。", "Модели с открытыми весами для рассуждений и программирования.", "Mô hình trọng số mở cho suy luận và lập trình."),
	"grok":            groupDescription("f6fc2f58", "Grok account pool with access to Grok 4.5 and Composer 2.5 Fast, balancing general reasoning and fast coding.", "Grok 账号池，可使用 Grok 4.5 和 Composer 2.5 Fast，兼顾通用推理与快速编程。", "Grok 帳號池，可使用 Grok 4.5 與 Composer 2.5 Fast，兼顧通用推理與快速程式設計。", "Pool de comptes Grok donnant accès à Grok 4.5 et Composer 2.5 Fast, pour concilier raisonnement général et code rapide.", "Grok 4.5 と Composer 2.5 Fast を利用でき、汎用推論と高速コーディングを両立する Grok アカウントプール。", "Пул аккаунтов Grok с доступом к Grok 4.5 и Composer 2.5 Fast для общих рассуждений и быстрого программирования.", "Nhóm tài khoản Grok hỗ trợ Grok 4.5 và Composer 2.5 Fast, cân bằng suy luận tổng quát và lập trình nhanh."),
	"chinese-group":   groupDescription("8d260dbc", "Open-weight models for reasoning and coding.", "用于推理和编程的开放权重模型。", "用於推理與程式設計的開放權重模型。", "Modèles à poids ouverts pour le raisonnement et le code.", "推論・コーディング向けのオープンウェイトモデル。", "Модели с открытыми весами для рассуждений и программирования.", "Mô hình trọng số mở cho suy luận và lập trình."),
	"openai-official": groupDescription("07787f32", "Official OpenAI API; full model access.", "OpenAI 官方 API，可访问完整模型。", "OpenAI 官方 API，可存取完整模型。", "API OpenAI officielle avec accès complet aux modèles.", "OpenAI 公式 API。全モデルにアクセスできます。", "Официальный API OpenAI с полным доступом к моделям.", "API OpenAI chính thức, hỗ trợ đầy đủ mô hình."),
	"image-cheap":     groupDescription("49820664", "Low-cost image route; no native 4K.", "低成本图片路由，不支持原生 4K。", "低成本圖片路由，不支援原生 4K。", "Route d’image économique, sans 4K natif.", "低コスト画像ルート。ネイティブ 4K は非対応です。", "Недорогой маршрут изображений без нативного 4K.", "Tuyến hình ảnh chi phí thấp, không hỗ trợ 4K gốc."),
	"__user_group__":  groupDescription("0cf40262", "User group", "用户分组", "使用者分組", "Groupe utilisateur", "ユーザーグループ", "Группа пользователя", "Nhóm người dùng"),
	"auto": {
		description: leaf("48f7afd0", translations("Automatic routing across available groups by priority.", "按优先级在可用分组间自动路由。", "依優先順序在可用分組間自動路由。", "Routage automatique entre les groupes disponibles par priorité.", "優先順位に従って利用可能なグループへ自動ルーティングします。", "Автоматическая маршрутизация по доступным группам в порядке приоритета.", "Tự động định tuyến qua các nhóm khả dụng theo thứ tự ưu tiên.")),
		ratio: func() *localizedLeaf {
			value := leaf("e3d822cf", translations("Auto", "自动", "自動", "Auto", "自動", "Авто", "Tự động"))
			return &value
		}(),
	},
}
