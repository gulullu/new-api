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

const noticeSourceHash = "5301ec8c"

// This is the exact production source that contained the retired "three
// steps" block. The block may only be removed when the entire source matches;
// an administrator edit must always win.
const noticeLegacySourceHash = "342bc16b"

type replacementPair [2]string

var noticeReplacements = map[Locale][]replacementPair{
	LocaleSimplifiedChinese: {
		{"https://relaybases.com/dashboard/token", "https://relaybases.com/keys"},
	},
	LocaleTraditionalChinese: {
		{"https://relaybases.com/dashboard/token", "https://relaybases.com/keys"},
		{"把生图、视频和 Agent 串进同一张画布", "把圖片生成、影片與 Agent 串接到同一張畫布"},
		{"无限画布已开放使用。可在一个工作台里组织 ", "無限畫布現已開放使用。可在同一個工作區中組織 "},
		{"让素材、提示词、结果和下一步想法保持在同一条创作链路里。", "讓素材、提示詞、結果與下一步想法保持在同一條創作流程中。"},
		{"素材、提示词、结果和分支想法集中管理。", "集中管理素材、提示詞、結果與分支想法。"},
		{"支持图片生成、编辑，以及视频任务。", "支援圖片生成、編輯與影片任務。"},
		{"快速启动海报、角色、产品图和分镜。", "快速開始海報、角色、產品圖與分鏡。"},
		{"用文本模型拆解任务并串联节点。", "使用文字模型拆解任務並串接節點。"},
		{"<strong style=\"color:#111;\">提示词库</strong>", "<strong style=\"color:#111;\">提示詞庫</strong>"},
		{"<strong style=\"color:#111;\">Agent 编排</strong>", "<strong style=\"color:#111;\">Agent 編排</strong>"},
		{"新功能上线", "新功能上線"}, {"图片生成", "圖片生成"}, {"视频任务", "影片任務"},
		{"提示词库", "提示詞庫"}, {"Agent 编排", "Agent 編排"}, {"打开无限画布", "開啟無限畫布"},
		{"创建 API Key", "建立 API Key"}, {"创意工作流", "創意工作流程"}, {"媒体模型", "媒體模型"},
	},
	LocaleEnglish: {
		{"https://relaybases.com/dashboard/token", "https://relaybases.com/keys"},
		{"把生图、视频和 Agent 串进同一张画布", "Bring image generation, video, and Agent workflows onto one canvas"},
		{"无限画布已开放使用。可在一个工作台里组织 ", "Infinite Canvas is now available. Organize "},
		{"让素材、提示词、结果和下一步想法保持在同一条创作链路里。", "Keep assets, prompts, results, and next-step ideas connected in one creative flow."},
		{"素材、提示词、结果和分支想法集中管理。", "Keep assets, prompts, results, and branch ideas organized in one place."},
		{"支持图片生成、编辑，以及视频任务。", "Supports image generation, editing, and video tasks."},
		{"快速启动海报、角色、产品图和分镜。", "Quickly start posters, characters, product images, and storyboards."},
		{"用文本模型拆解任务并串联节点。", "Use text models to break down tasks and connect nodes."},
		{"<strong style=\"color:#111;\">提示词库</strong>", "<strong style=\"color:#111;\">a prompt library</strong>"},
		{"<strong style=\"color:#111;\">Agent 编排</strong>", "<strong style=\"color:#111;\">Agent workflows</strong>"},
		{"新功能上线", "Now Available"}, {"图片生成", "image generation"}, {"视频任务", "video tasks"},
		{"提示词库", "Prompt Library"}, {"Agent 编排", "Agent Orchestration"}, {"打开无限画布", "Open Infinite Canvas"},
		{"创建 API Key", "Create API Key"}, {"创意工作流", "Creative Workflow"}, {"媒体模型", "Media Models"},
		{" 和 ", ", and "}, {"，", " in one workspace. "}, {"、", ", "},
	},
	LocaleFrench: {
		{"https://relaybases.com/dashboard/token", "https://relaybases.com/keys"},
		{"把生图、视频和 Agent 串进同一张画布", "Réunissez la génération d’images, la vidéo et les Agents sur un même canevas"},
		{"无限画布已开放使用。可在一个工作台里组织 ", "Infinite Canvas est disponible. Organisez dans un même espace "},
		{"让素材、提示词、结果和下一步想法保持在同一条创作链路里。", "Gardez les ressources, prompts, résultats et prochaines idées dans un même flux créatif."},
		{"素材、提示词、结果和分支想法集中管理。", "Centralisez ressources, prompts, résultats et idées dérivées."},
		{"支持图片生成、编辑，以及视频任务。", "Prend en charge la génération et l’édition d’images ainsi que les tâches vidéo."},
		{"快速启动海报、角色、产品图和分镜。", "Démarrez rapidement affiches, personnages, visuels produit et storyboards."},
		{"用文本模型拆解任务并串联节点。", "Utilisez les modèles texte pour décomposer les tâches et relier les étapes."},
		{"新功能上线", "Nouveau"}, {"图片生成", "génération d’images"}, {"视频任务", "tâches vidéo"},
		{"提示词库", "Bibliothèque de prompts"}, {"Agent 编排", "Orchestration d’Agents"}, {"打开无限画布", "Ouvrir Infinite Canvas"},
		{"创建 API Key", "Créer une clé API"}, {"创意工作流", "Flux créatif"}, {"媒体模型", "Modèles multimédias"},
	},
	LocaleJapanese: {
		{"https://relaybases.com/dashboard/token", "https://relaybases.com/keys"},
		{"把生图、视频和 Agent 串进同一张画布", "画像生成、動画、Agent を 1 つのキャンバスでつなぐ"},
		{"无限画布已开放使用。可在一个工作台里组织 ", "Infinite Canvas が利用可能です。1 つのワークスペースで整理できます："},
		{"让素材、提示词、结果和下一步想法保持在同一条创作链路里。", "素材、プロンプト、結果、次のアイデアを 1 つの制作フローにまとめます。"},
		{"素材、提示词、结果和分支想法集中管理。", "素材、プロンプト、結果、分岐アイデアを一元管理します。"},
		{"支持图片生成、编辑，以及视频任务。", "画像の生成・編集と動画タスクに対応します。"},
		{"快速启动海报、角色、产品图和分镜。", "ポスター、キャラクター、商品画像、絵コンテをすぐに始められます。"},
		{"用文本模型拆解任务并串联节点。", "テキストモデルでタスクを分解し、ノードを連携します。"},
		{"新功能上线", "新機能"}, {"图片生成", "画像生成"}, {"视频任务", "動画タスク"},
		{"提示词库", "プロンプトライブラリ"}, {"Agent 编排", "Agent オーケストレーション"}, {"打开无限画布", "Infinite Canvas を開く"},
		{"创建 API Key", "API Key を作成"}, {"创意工作流", "クリエイティブワークフロー"}, {"媒体模型", "メディアモデル"},
	},
	LocaleRussian: {
		{"https://relaybases.com/dashboard/token", "https://relaybases.com/keys"},
		{"把生图、视频和 Agent 串进同一张画布", "Объедините изображения, видео и Агентов на одном холсте"},
		{"无限画布已开放使用。可在一个工作台里组织 ", "Infinite Canvas уже доступен. В одном рабочем пространстве можно организовать "},
		{"让素材、提示词、结果和下一步想法保持在同一条创作链路里。", "Сохраняйте материалы, промпты, результаты и новые идеи в едином творческом процессе."},
		{"素材、提示词、结果和分支想法集中管理。", "Храните материалы, промпты, результаты и ответвления идей в одном месте."},
		{"支持图片生成、编辑，以及视频任务。", "Поддерживает генерацию и редактирование изображений, а также видео."},
		{"快速启动海报、角色、产品图和分镜。", "Быстро создавайте постеры, персонажей, изображения товаров и раскадровки."},
		{"用文本模型拆解任务并串联节点。", "Разбивайте задачи текстовыми моделями и связывайте узлы."},
		{"新功能上线", "Новая функция"}, {"图片生成", "генерация изображений"}, {"视频任务", "видео-задачи"},
		{"提示词库", "Библиотека промптов"}, {"Agent 编排", "Оркестрация Агентов"}, {"打开无限画布", "Открыть Infinite Canvas"},
		{"创建 API Key", "Создать API Key"}, {"创意工作流", "Творческий процесс"}, {"媒体模型", "Медиа-модели"},
	},
	LocaleVietnamese: {
		{"https://relaybases.com/dashboard/token", "https://relaybases.com/keys"},
		{"把生图、视频和 Agent 串进同一张画布", "Kết nối tạo hình ảnh, video và Agent trên cùng một canvas"},
		{"无限画布已开放使用。可在一个工作台里组织 ", "Infinite Canvas đã khả dụng. Tổ chức trong cùng một không gian làm việc "},
		{"让素材、提示词、结果和下一步想法保持在同一条创作链路里。", "Giữ tài nguyên, prompt, kết quả và ý tưởng tiếp theo trong cùng một quy trình sáng tạo."},
		{"素材、提示词、结果和分支想法集中管理。", "Quản lý tập trung tài nguyên, prompt, kết quả và các nhánh ý tưởng."},
		{"支持图片生成、编辑，以及视频任务。", "Hỗ trợ tạo và chỉnh sửa hình ảnh cùng các tác vụ video."},
		{"快速启动海报、角色、产品图和分镜。", "Nhanh chóng bắt đầu poster, nhân vật, ảnh sản phẩm và storyboard."},
		{"用文本模型拆解任务并串联节点。", "Dùng mô hình văn bản để chia nhỏ tác vụ và nối các nút."},
		{"新功能上线", "Tính năng mới"}, {"图片生成", "tạo hình ảnh"}, {"视频任务", "tác vụ video"},
		{"提示词库", "Thư viện prompt"}, {"Agent 编排", "Điều phối Agent"}, {"打开无限画布", "Mở Infinite Canvas"},
		{"创建 API Key", "Tạo API Key"}, {"创意工作流", "Quy trình sáng tạo"}, {"媒体模型", "Mô hình đa phương tiện"},
	},
}
