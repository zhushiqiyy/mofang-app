/* =========================================================================
   65-skins.js — 玩伴 + 皮肤小屋 + 皮肤
   -------------------------------------------------------------------------
   · 魔方皮肤 = 只换"特效"，六面基础颜色始终保留（经典六色）
   · 玩伴 = 按参考图分层建模（背翼/身体/手臂/头…），CSS 3D 景深 + 背板，
     旋转时有真实视差与厚度，不是纸片人；可拖动旋转
   · 皮肤小屋 = 所有皮肤免费直接装备（无积分、无购买）
   ========================================================================= */

/* =========================================================================
   一、角色分层模型
   每个角色 = 若干"层"，层与层放在不同 translateZ（越大越靠近观众）。
   旋转时近层位移大、远层位移小 → 真实视差；每层自动复制一张背板
   （rotateY(180deg)）→ 转到背面也有厚度，不会变成一张薄纸。
   每层 SVG 用同一坐标系（viewBox 0 0 120 120），直接叠起来就是完整角色。
   ========================================================================= */

/* ---------------- 天女兽 Angewomon ---------------- */
/* 远层：背后大羽翼（8 片）。只有真正"外凸"的部件才放远景深 */
const ANGE_FAR =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs>'
+ '<linearGradient id="ag-wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef4fd"/><stop offset="1" stop-color="#bdd2ef"/></linearGradient>'
+ '</defs>'
/* 左上大翅 */
+ '<path d="M59 48 C46 28 22 20 6 30 C17 37 21 48 22 59 C12 63 5 74 8 87 C24 76 44 68 60 63 Z" fill="url(#ag-wg)" stroke="#c6d9f3" stroke-width="1"/>'
/* 左下翅 */
+ '<path d="M59 58 C46 64 28 72 19 89 C31 85 43 81 59 75 Z" fill="url(#ag-wg)" stroke="#c6d9f3" stroke-width="1"/>'
/* 右上大翅 */
+ '<path d="M61 48 C74 28 98 20 114 30 C103 37 99 48 98 59 C108 63 115 74 112 87 C96 76 76 68 60 63 Z" fill="url(#ag-wg)" stroke="#c6d9f3" stroke-width="1"/>'
/* 右下翅 */
+ '<path d="M61 58 C74 64 92 72 101 89 C89 85 77 81 61 75 Z" fill="url(#ag-wg)" stroke="#c6d9f3" stroke-width="1"/>'
/* 羽脉 */
+ '<path d="M58 54 C42 42 26 38 13 42" stroke="#dfeaf9" stroke-width="1.1" fill="none"/>'
+ '<path d="M58 60 C44 66 32 72 24 80" stroke="#dfeaf9" stroke-width="1.1" fill="none"/>'
+ '<path d="M62 54 C78 42 94 38 107 42" stroke="#dfeaf9" stroke-width="1.1" fill="none"/>'
+ '<path d="M62 60 C76 66 88 72 96 80" stroke="#dfeaf9" stroke-width="1.1" fill="none"/>'
+ '</svg>';

/* 中层：躯干 + 羽裙 + 腿 + 金靴 */
const ANGE_MID =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs>'
+ '<linearGradient id="ag-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f3f6fc"/><stop offset="1" stop-color="#d9e3f2"/></linearGradient>'
+ '<linearGradient id="ag-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffeaa8"/><stop offset="1" stop-color="#cf9526"/></linearGradient>'
+ '</defs>'
/* 腿 */
+ '<path d="M52 82 L57 82 L56 102 L51 102 Z" fill="#ffe6d2"/>'
+ '<path d="M63 82 L68 82 L69 102 L64 102 Z" fill="#ffe6d2"/>'
/* 金靴 */
+ '<path d="M48 99 L59 99 L58 113 L47 113 Z" fill="url(#ag-gold)" stroke="#b98420" stroke-width=".8"/>'
+ '<path d="M61 99 L72 99 L73 113 L62 113 Z" fill="url(#ag-gold)" stroke="#b98420" stroke-width=".8"/>'
/* 白色羽裙（前） */
+ '<path d="M45 80 Q60 89 75 80 L73 95 Q60 102 47 95 Z" fill="url(#ag-body)" stroke="#d5e0ef" stroke-width="1"/>'
/* 紫色臀腿甲（参考图特征色） */
+ '<path d="M48 74 Q60 80 72 74 L73 86 Q60 92 47 86 Z" fill="#b57bd8" stroke="#8a4fb0" stroke-width=".9"/>'
+ '<path d="M60 76 L60 88" stroke="#8a4fb0" stroke-width=".8"/>'
/* 躯干连体衣 */
+ '<path d="M46 45 Q60 39 74 45 L78 84 Q60 92 42 84 Z" fill="url(#ag-body)" stroke="#dbe4f1" stroke-width="1.1"/>'
/* 金色腰封 */
+ '<path d="M45 70 Q60 76 75 70 L75 79 Q60 85 45 79 Z" fill="url(#ag-gold)"/>'
+ '<path d="M60 70 L60 79" stroke="#b98420" stroke-width=".8"/>'
+ '</svg>';

/* 近层：双臂（白袖 + 粉色丝带缠绕）+ 胸甲 */
const ANGE_NEAR =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs>'
+ '<linearGradient id="ag-rib" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3d9"/><stop offset="1" stop-color="#e86aa8"/></linearGradient>'
+ '<linearGradient id="ag-gold2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffeaa8"/><stop offset="1" stop-color="#d69a2e"/></linearGradient>'
+ '</defs>'
/* 白袖（上臂） */
+ '<path d="M48 50 Q42 56 39 63" stroke="#f4f8fd" stroke-width="7.5" fill="none" stroke-linecap="round"/>'
+ '<path d="M72 50 Q78 56 81 63" stroke="#f4f8fd" stroke-width="7.5" fill="none" stroke-linecap="round"/>'
/* 小臂（肤色） */
+ '<path d="M39 63 Q36 67 35 71" stroke="#ffe6d2" stroke-width="6" fill="none" stroke-linecap="round"/>'
+ '<path d="M81 63 Q84 67 85 71" stroke="#ffe6d2" stroke-width="6" fill="none" stroke-linecap="round"/>'
+ '<circle cx="34" cy="72" r="4" fill="#ffe6d2"/>'
+ '<circle cx="86" cy="72" r="4" fill="#ffe6d2"/>'
/* 粉色丝带：绕双臂飘动 */
+ '<path d="M36 64 Q28 56 20 58 Q28 64 24 74 Q32 72 38 70 Z" fill="url(#ag-rib)" opacity=".95"/>'
+ '<path d="M84 64 Q92 56 100 58 Q92 64 96 74 Q88 72 82 70 Z" fill="url(#ag-rib)" opacity=".95"/>'
+ '<path d="M34 68 Q26 78 30 92 Q36 82 40 74 Z" fill="url(#ag-rib)" opacity=".8"/>'
+ '<path d="M86 68 Q94 78 90 92 Q84 82 80 74 Z" fill="url(#ag-rib)" opacity=".8"/>'
/* 金色胸甲（V 形 + 中央宝石） */
+ '<path d="M50 46 L70 46 L60 66 Z" fill="url(#ag-gold2)" stroke="#b98420" stroke-width=".8"/>'
+ '<path d="M50 46 L60 46 L56 56 Z" fill="#fff3cf" opacity=".55"/>'
+ '<circle cx="60" cy="58" r="3.2" fill="#7fd8ff" stroke="#3f9fd0" stroke-width=".9"/>'
+ '</svg>';

/* 最前层：头 + 翼盔 + 光环 + 金发前层 */
const ANGE_HEAD =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs>'
+ '<linearGradient id="ag-halo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6cf"/><stop offset=".5" stop-color="#ffe066"/><stop offset="1" stop-color="#fff6cf"/></linearGradient>'
+ '<linearGradient id="ag-helm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfdcec"/></linearGradient>'
+ '<radialGradient id="ag-hair2" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#d99a2e"/></radialGradient>'
+ '<linearGradient id="ag-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd76a"/><stop offset="1" stop-color="#cf8c1c"/></linearGradient>'
+ '</defs>'
/* 光环 */
+ '<ellipse cx="60" cy="18" rx="16" ry="4.6" fill="none" stroke="url(#ag-halo)" stroke-width="3.2"/>'
+ '<ellipse cx="60" cy="18" rx="16" ry="4.6" fill="none" stroke="#fff8dc" stroke-width="1" opacity=".8"/>'
/* 金发后层（及腰，与头同层，只是画在脸后面，不会随旋转脱节） */
+ '<path d="M47 33 Q39 58 45 92 Q60 101 75 92 Q81 58 73 33 Q60 26 47 33 Z" fill="url(#ag-hair)"/>'
/* 脸 */
+ '<circle cx="60" cy="39" r="12.5" fill="#ffe6d2"/>'
/* 翼盔：头顶 + 两侧翼 */
+ '<path d="M47 38 Q46 24 60 23 Q74 24 73 38 Q66 30 60 30 Q54 30 47 38 Z" fill="url(#ag-helm)" stroke="#c3d2e4" stroke-width=".9"/>'
+ '<path d="M47 33 L36 26 L44 36 Z" fill="url(#ag-helm)" stroke="#c3d2e4" stroke-width=".8"/>'
+ '<path d="M73 33 L84 26 L76 36 Z" fill="url(#ag-helm)" stroke="#c3d2e4" stroke-width=".8"/>'
+ '<path d="M55 23 L60 17 L65 23 L60 27 Z" fill="#ffe066" stroke="#d9a92a" stroke-width=".7"/>'
/* 金发前层（刘海 + 两侧长发） */
+ '<path d="M48 36 Q47 24 60 23 Q73 24 72 36 Q66 28 60 29 Q54 28 48 36 Z" fill="url(#ag-hair2)"/>'
+ '<path d="M48 34 Q44 52 48 74 Q52 56 52 38 Z" fill="url(#ag-hair2)"/>'
+ '<path d="M72 34 Q76 52 72 74 Q68 56 68 38 Z" fill="url(#ag-hair2)"/>'
/* 五官 */
+ '<path d="M53 38 Q55.5 36 58 38" stroke="#6b4a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
+ '<path d="M62 38 Q64.5 36 67 38" stroke="#6b4a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
+ '<circle cx="55.5" cy="40" r="1.7" fill="#4a3018"/><circle cx="64.5" cy="40" r="1.7" fill="#4a3018"/>'
+ '<path d="M57 46 Q60 48.5 63 46" stroke="#c8743f" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
+ '</svg>';

/* ---------------- 名侦探柯南 ---------------- */
const CONAN_FAR =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<path d="M44 56 Q60 50 76 56 L80 92 Q60 98 40 92 Z" fill="#2c4d8c" opacity=".6"/>'
+ '</svg>';

const CONAN_MID =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs><linearGradient id="cn-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4169c4"/><stop offset="1" stop-color="#1c3c76"/></linearGradient></defs>'
+ '<rect x="51" y="86" width="9" height="22" rx="4" fill="#26406e"/><rect x="60" y="86" width="9" height="22" rx="4" fill="#26406e"/>'
+ '<rect x="50" y="104" width="11" height="7" rx="3" fill="#d23b3b"/><rect x="59" y="104" width="11" height="7" rx="3" fill="#d23b3b"/>'
+ '<path d="M44 52 Q60 46 76 52 L80 88 Q60 96 40 88 Z" fill="url(#cn-s)"/>'
+ '</svg>';

const CONAN_NEAR =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs><linearGradient id="cn-s2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4169c4"/><stop offset="1" stop-color="#1c3c76"/></linearGradient></defs>'
+ '<rect x="37" y="56" width="9" height="24" rx="4" fill="url(#cn-s2)"/><rect x="74" y="56" width="9" height="24" rx="4" fill="url(#cn-s2)"/>'
+ '<path d="M53 52 L67 52 L60 80 Z" fill="#ffffff"/>'
+ '<path d="M60 54 L53 51 L53 58 Z" fill="#d23b3b"/><path d="M60 54 L67 51 L67 58 Z" fill="#d23b3b"/>'
+ '<rect x="58.3" y="52" width="3.4" height="5" rx="1.4" fill="#a8231d"/>'
+ '</svg>';

const CONAN_HEAD =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<circle cx="60" cy="39" r="14.5" fill="#ffe2c4"/>'
+ '<path d="M45.5 39 Q44.5 21 60 20 Q75.5 21 74.5 39 Q71 28 60 28 Q49 28 45.5 39 Z" fill="#2b2f3a"/>'
+ '<path d="M45 36 Q48 31 53 30 L52 37 Z" fill="#2b2f3a"/><path d="M75 36 Q72 31 67 30 L68 37 Z" fill="#2b2f3a"/>'
+ '<circle cx="54" cy="39" r="5.6" fill="none" stroke="#141414" stroke-width="1.7"/>'
+ '<circle cx="66" cy="39" r="5.6" fill="none" stroke="#141414" stroke-width="1.7"/>'
+ '<path d="M59.4 39 L60.6 39" stroke="#141414" stroke-width="1.7"/>'
+ '<circle cx="54" cy="39" r="1.7" fill="#222"/><circle cx="66" cy="39" r="1.7" fill="#222"/>'
+ '<path d="M56 47 Q60 49.5 64 47" stroke="#c8743f" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
+ '</svg>';

/* ---------------- 皮卡丘 ---------------- */
const PIKA_FAR =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs><radialGradient id="pk-y" cx="0.4" cy="0.32" r="0.9"><stop offset="0" stop-color="#ffe85c"/><stop offset="1" stop-color="#e2a91b"/></radialGradient></defs>'
+ '<path d="M78 82 L96 58 L88 61 L101 41 L74 66 L83 63 Z" fill="#f2c73a" stroke="#caa015" stroke-width="1"/>'
+ '<path d="M78 82 L87 70 L83 72 L93 55 L74 74 Z" fill="#8a5a1a"/>'
+ '</svg>';

const PIKA_MID =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs><radialGradient id="pk-y2" cx="0.4" cy="0.32" r="0.9"><stop offset="0" stop-color="#ffe85c"/><stop offset="1" stop-color="#e2a91b"/></radialGradient></defs>'
+ '<rect x="50" y="90" width="9" height="16" rx="4" fill="url(#pk-y2)"/><rect x="61" y="90" width="9" height="16" rx="4" fill="url(#pk-y2)"/>'
+ '<path d="M44 56 Q60 48 76 56 L80 92 Q60 100 40 92 Z" fill="url(#pk-y2)" stroke="#d9a91a" stroke-width="1.1"/>'
+ '<path d="M48 62 Q52 70 50 82" stroke="#caa015" stroke-width="2" fill="none" opacity=".6"/>'
+ '<path d="M72 62 Q68 70 70 82" stroke="#caa015" stroke-width="2" fill="none" opacity=".6"/>'
+ '</svg>';

const PIKA_NEAR =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs><radialGradient id="pk-y3" cx="0.4" cy="0.32" r="0.9"><stop offset="0" stop-color="#ffe85c"/><stop offset="1" stop-color="#e2a91b"/></radialGradient></defs>'
+ '<rect x="37" y="60" width="9" height="20" rx="4.5" fill="url(#pk-y3)" stroke="#d9a91a"/><rect x="74" y="60" width="9" height="20" rx="4.5" fill="url(#pk-y3)" stroke="#d9a91a"/>'
+ '</svg>';

const PIKA_HEAD =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<defs><radialGradient id="pk-y4" cx="0.4" cy="0.32" r="0.9"><stop offset="0" stop-color="#ffe85c"/><stop offset="1" stop-color="#e2a91b"/></radialGradient></defs>'
+ '<circle cx="60" cy="42" r="17" fill="url(#pk-y4)" stroke="#d9a91a" stroke-width="1.1"/>'
+ '<path d="M48 31 L39 10 L55 25 Z" fill="url(#pk-y4)" stroke="#d9a91a"/><path d="M72 31 L81 10 L65 25 Z" fill="url(#pk-y4)" stroke="#d9a91a"/>'
+ '<path d="M46 25 L42 14 L51 23 Z" fill="#2b2b2b"/><path d="M74 25 L78 14 L69 23 Z" fill="#2b2b2b"/>'
+ '<circle cx="47" cy="48" r="4.2" fill="#ff5a5a"/><circle cx="73" cy="48" r="4.2" fill="#ff5a5a"/>'
+ '<circle cx="53" cy="40" r="3.5" fill="#1a1a1a"/><circle cx="67" cy="40" r="3.5" fill="#1a1a1a"/>'
+ '<circle cx="54" cy="39" r="1.2" fill="#fff"/><circle cx="68" cy="39" r="1.2" fill="#fff"/>'
+ '<path d="M57 49 Q60 52 63 49" stroke="#7a5a10" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
+ '<path d="M95 17 l2.6 -5 0.6 5 5 0.6 -5 0.8 -0.6 5 -2.6 -5 -5 -0.8 Z" fill="#ffe14d" opacity=".9"/>'
+ '</svg>';

/* ---------------- 奶龙（降级用简笔，正常走真 3D GLB） ---------------- */
const NL_FAR =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<path d="M46 60 Q60 54 74 60 L80 96 Q60 104 40 96 Z" fill="#ffcf5a" opacity=".5"/>'
+ '</svg>';
const NL_MID =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<path d="M50 92 L58 92 L57 106 L51 106 Z" fill="#f5b733"/><path d="M62 92 L70 92 L69 106 L63 106 Z" fill="#f5b733"/>'
+ '<path d="M42 56 Q60 46 78 56 L82 94 Q60 104 38 94 Z" fill="#ffd45e" stroke="#e9a81e" stroke-width="1.2"/>'
+ '<path d="M50 66 Q60 72 70 66" stroke="#ffe9a8" stroke-width="3" fill="none" stroke-linecap="round"/>'
+ '<path d="M78 86 Q96 84 92 70" stroke="#ffd45e" stroke-width="8" fill="none" stroke-linecap="round"/>'
+ '</svg>';
const NL_NEAR =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<path d="M42 62 Q34 68 34 80" stroke="#ffd45e" stroke-width="8" fill="none" stroke-linecap="round"/>'
+ '<path d="M78 62 Q86 68 86 78" stroke="#ffd45e" stroke-width="8" fill="none" stroke-linecap="round"/>'
+ '</svg>';
const NL_HEAD =
'<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
+ '<ellipse cx="60" cy="40" rx="20" ry="18" fill="#ffd968" stroke="#e9a81e" stroke-width="1.2"/>'
+ '<path d="M44 26 Q42 14 50 22 Z" fill="#ffd45e"/><path d="M76 26 Q78 14 70 22 Z" fill="#ffd45e"/>'
+ '<circle cx="52" cy="40" r="3.2" fill="#2b2b2b"/><circle cx="68" cy="40" r="3.2" fill="#2b2b2b"/>'
+ '<circle cx="53" cy="39" r="1" fill="#fff"/><circle cx="69" cy="39" r="1" fill="#fff"/>'
+ '<ellipse cx="60" cy="50" rx="4" ry="2.6" fill="#ffe9a8"/>'
+ '<path d="M55 55 Q60 59 65 55" stroke="#c98a1a" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
+ '</svg>';

/* ---------------- 分层模型表 ----------------
   z：景深（越大越靠前）。近大远小交给 perspective 自动完成（物理正确），
   只有真正"外凸"的部件（羽翼 / 背剑 / 尾巴）才给大景深，
   贴身部件（后摆 / 后发 / 背影）只放微景深，旋转时不会和身体脱节。 */
const COMP_MODELS = {
  ange:{ layers:[
    { z:-150, art:ANGE_FAR },
    { z:-70,  art:ANGE_MID },
    { z:-12,  art:ANGE_NEAR },
    { z:56,   art:ANGE_HEAD }
  ]},
  conan:{ layers:[
    { z:-40,  art:CONAN_FAR },
    { z:0,    art:CONAN_MID },
    { z:-12,  art:CONAN_NEAR },
    { z:68,   art:CONAN_HEAD }
  ]},
  pika:{ layers:[
    { z:-90,  art:PIKA_FAR },
    { z:0,    art:PIKA_MID },
    { z:-10,  art:PIKA_NEAR },
    { z:60,   art:PIKA_HEAD }
  ]},
  nailong:{ layers:[
    { z:-50,  art:NL_FAR },
    { z:0,    art:NL_MID },
    { z:-10,  art:NL_NEAR },
    { z:60,   art:NL_HEAD }
  ]}
};

/* ---------------- 皮肤定义 ----------------
   魔方皮肤两类：
   · 特效皮肤(fx)：背后加泡泡/星芒/光晕/流光等（保留六面基础色）。
   · 主题皮肤(theme)：每个面按主题贴图（泡泡/星星/爱心/花朵），无光晕——整面同色即看完整图案。
   两者六面基础颜色始终保留（经典六色）。全部免费。 */
const SKINS = {
  cube: {
    classic:{ name:'经典六色', fx:null },
    flame:  { name:'烈焰红莲', fx:'flame' },
    ocean:  { name:'深海蔚蓝', fx:'ocean' },
    forest: { name:'翡翠森林', fx:'forest' },
    sun:    { name:'暖阳金辉', fx:'sun' },
    galaxy: { name:'星河紫梦', fx:'galaxy' },
    aurora: { name:'极光绚烂', fx:'aurora' },
    bubble: { name:'泡泡糖',   fx:'bubble' },
    brill:  { name:'流光彩钻', fx:'brill' },
    thBubble:{ name:'泡泡主题', theme:'bubble', desc:'每面都是同色泡泡，整面还原=一整片泡泡' },
    thStar:  { name:'星星主题', theme:'star',   desc:'每面都是同色星星，整面还原=满天星' },
    thHeart: { name:'爱心主题', theme:'heart',  desc:'每面都是同色爱心，整面还原=一片爱心' },
    thFlower:{ name:'花朵主题', theme:'flower', desc:'每面都是同色花朵，整面还原=一园花' }
  },
  /* 玩伴皮肤：只保留 4 个真 3D 助手（小助手/迪迦/李星云已移除）；aura = 展厅光环色 */
  comp: {
    conan:  { name:'名侦探柯南',   aura:'#3a63b8' },
    ange:   { name:'天女兽',       aura:'#ffd45e' },
    pika:   { name:'皮卡丘',       aura:'#ffd83d' },
    nailong:{ name:'奶龙',         aura:'#ffcf5a' }
  }
};
const DEFAULT_COMP = 'conan';   /* 默认玩伴 = 柯南（小助手已移除） */

let curCubeSkin = 'classic';
let curCompSkin = DEFAULT_COMP;

/* 启动时把已保存的皮肤套上去（在 boot 里调用） */
function initSkins(){
  curCubeSkin = (store.skins && store.skins.cube) || 'classic';
  /* 兼容老存档：小助手/迪迦/李星云已移除，旧值统一回退到默认玩伴柯南 */
  const saved = (store.skins && store.skins.comp) || DEFAULT_COMP;
  curCompSkin = SKINS.comp[saved] ? saved : DEFAULT_COMP;
  store.skins.comp = curCompSkin;
  setCubeSkin(curCubeSkin, true);   /* 仅设置特效，颜色保持经典 */
}

/* 换魔方皮肤（特效或主题）。六面基础颜色始终不变 */
function setCubeSkin(id, silent){
  const sk = SKINS.cube[id];
  if (!sk) return;
  CUBE_FX = sk.fx || null;          /* 特效皮肤：背后光晕/粒子 */
  CUBE_THEME = sk.theme || null;    /* 主题皮肤：每面按主题贴图，无光晕 */
  curCubeSkin = id;
  if (!silent) saveStore();
}

/* 装备皮肤（全部免费，直接换） */
function equipSkin(kind, id){
  if (!SKINS[kind] || !SKINS[kind][id]) return;
  if (kind === 'cube'){ store.skins.cube = id; setCubeSkin(id, true); }
  else { store.skins.comp = id; curCompSkin = id; }
  saveStore();
  refreshTopStars();
  toast('已换上「' + SKINS[kind][id].name + '」');
  renderPage(currentPage);   /* 重画当前页（含魔方预览 / 玩伴） */
}

/* =========================================================================
   二、3D 分层舞台
   ========================================================================= */

/* 真 3D 玩伴角色（有 GLB 模型）：柯南 / 天女兽 / 皮卡丘 / 奶龙。
   其余角色（小助手/迪迦/李星云）没有模型，继续用下面的 SVG 分层舞台。 */
function hasReal3D(id){ return !!(window.Mascot3D && window.Mascot3D.has3D && window.Mascot3D.has3D(id)); }

/* 生成玩伴舞台：有真 3D 模型的角色用 WebGL host，其余用 SVG 分层 */
function companion3DMarkup(id, mini){
  if (hasReal3D(id)){
    return '<div class="m3d-host' + (mini ? ' mini' : '') + '" data-role="' + id + '"></div>'
      + '<div class="stage-hint" style="position:static;display:block;text-align:center;margin-top:2px">🖐 拖动旋转</div>';
  }
  return companionSvgMarkup(id, mini);
}

/* 原 SVG 分层舞台（无 3D 模型 / 加载失败降级用） */
function companionSvgMarkup(id, mini){
  const m = COMP_MODELS[id] || COMP_MODELS[DEFAULT_COMP];
  const sk = SKINS.comp[id] || SKINS.comp[DEFAULT_COMP];
  const layers = mini ? m.layers.filter(L => L.z >= -80) : m.layers;
  let h = '<div class="stage3d' + (mini ? ' mini' : '') + '">'
    + '<div class="stage3d-inner" data-tt>'
    + '<div class="aura" style="--c:' + (sk.aura || '#5b8cff') + '"></div>';
  layers.forEach(L => {
    const sc = L.scale == null ? 1 : L.scale;
    h += '<div class="char-layer" style="transform:translateZ(' + L.z + 'px) scale(' + sc + ')">' + L.art + '</div>';
    if (!mini && L.back !== false){
      h += '<div class="char-layer char-back" data-back="1" style="transform:translateZ(' + (L.z - 2.5) + 'px) scale(' + sc + ') rotateY(180deg)">' + L.art + '</div>';
    }
  });
  h += '<div class="pedestal"><div class="ped-top"></div><div class="ped-side"></div></div>'
    + '<div class="char-shadow"></div>'
    + '</div>'
    + '<div class="stage-hint">🖐 拖动旋转</div>'
    + '</div>';
  return h;
}

/* 给 host 挂载 3D 玩伴；失败时降级回 SVG 分层舞台 */
function mountCompanion3D(host, id, mini){
  if (!host || !hasReal3D(id)) return false;
  try {
    window.Mascot3D.mount(host, id, {
      mini: !!mini,
      onFail: () => { host.innerHTML = companionSvgMarkup(id, mini); const st = host.querySelector('.stage3d'); if (st) mountStage3D(st); }
    });
    return true;
  } catch (e) {
    host.innerHTML = companionSvgMarkup(id, mini);
    const st = host.querySelector('.stage3d'); if (st) mountStage3D(st);
    return false;
  }
}

/* rAF 驱动所有已挂载的舞台：自动摆动 + 拖动旋转 + 松手回正 + 动态受光 */
const _stages = [];
function mountStage3D(stage){
  if (!stage || stage._mounted) return;
  stage._mounted = true;
  const inner = stage.querySelector('[data-tt]');
  if (!inner) return;
  /* 收集所有层（含背板），用于按朝向动态调光 */
  const plates = Array.from(stage.querySelectorAll('.char-layer')).map(el => ({ el, back: el.getAttribute('data-back') === '1' }));
  const s = { inner, plates, ry:0, dragRy:0, dragging:false, lastX:0, phase: Math.random()*6.28, t0: performance.now(), shadeQ: -9 };
  stage.addEventListener('pointerdown', e => { s.dragging = true; s.lastX = e.clientX; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => {
    if (!s.dragging) return;
    const dx = e.clientX - s.lastX; s.lastX = e.clientX;
    s.dragRy = Math.max(-72, Math.min(72, s.dragRy + dx * 0.45));
  });
  const end = () => { s.dragging = false; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('pointerleave', end);
  _stages.push(s);
}
/* 动态受光：层面向观众时亮，转过去时暗；背板保持稳定的"暗边"（厚度感）。
   量化到 1/16 一档，避免每帧写 style。 */
function applyShade(s, ry){
  const cos = Math.cos(ry * Math.PI / 180);
  const q = Math.round(cos * 16);
  if (q === s.shadeQ) return;
  s.shadeQ = q;
  const c = q / 16;
  for (const p of s.plates){
    const f = p.back ? -c : c;                       /* 背板法线相反 */
    const k = 0.34 + 0.66 * Math.max(0, f);          /* 0.34 ~ 1.00 */
    p.el.style.filter = p.back
      ? 'brightness(' + (0.62 * k).toFixed(2) + ') saturate(.75)'
      : 'brightness(' + k.toFixed(2) + ')';
  }
}
(function stageTick(){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = performance.now();
  for (let i = _stages.length - 1; i >= 0; i--){
    const s = _stages[i];
    if (!s.inner.isConnected){ _stages.splice(i, 1); continue; }   /* 页面切换后清理，避免堆积 */
    if (!s.dragging) s.dragRy += (0 - s.dragRy) * 0.055;           /* 松手缓缓回正 */
    const auto = reduce ? 0 : Math.sin((now - s.t0) / 1700 + s.phase) * 16;
    s.ry = auto + s.dragRy;
    s.inner.style.transform = 'rotateY(' + s.ry.toFixed(1) + 'deg)';
    applyShade(s, s.ry);
  }
  requestAnimationFrame(stageTick);
})();

function companionSay(){
  const s = store;
  if ((s.streak||0) >= 7) return '你已经连练 ' + s.streak + ' 天啦，超厉害！继续坚持～';
  if ((s.battle.w||0) >= 3) return '人机对战赢了 ' + s.battle.w + ' 次，去挑战更难的吧！';
  if (totalStars() >= 30) return '你已经点亮 ' + totalStars() + ' 招了，进步飞快！';
  if ((s.quest && Object.keys(s.quest).length) >= 3) return '已经闯过好几关了，你越来越像魔方高手！';
  return '今天也来练一招吧，我陪你一起～';
}

function renderCompanion(host){
  if (!host) return;
  const sk = SKINS.comp[curCompSkin] || SKINS.comp[DEFAULT_COMP];
  host.innerHTML =
    '<div class="companion3d">'
    + '<div class="companion-stage">' + companion3DMarkup(curCompSkin) + '</div>'
    + '<div class="companion-info">'
      + '<div class="companion-name">' + sk.name + ' <span class="sub">陪你练魔方</span></div>'
      + '<div class="companion-bubble">' + companionSay() + '</div>'
      + '<div class="row" style="margin-top:8px;gap:8px;">'
      + '<button class="btn alt sm" onclick="go(\'skin\')">🎨 皮肤小屋</button>'
      + '</div>'
    + '</div>'
    + '</div>';
  const stage = host.querySelector('.companion-stage');
  const mhost = stage && stage.querySelector('.m3d-host');
  if (mhost) mountCompanion3D(mhost, curCompSkin, false);
  else { const st = host.querySelector('.stage3d'); if (st) mountStage3D(st); }
}

/* 3D 引擎是异步 module：就绪后把当前页玩伴重挂一次（首页/实战页/皮肤小屋） */
window.addEventListener('mascot3d-ready', () => {
  try {
    const hc = $('home-companion'); if (hc && hc.offsetParent !== null) renderCompanion(hc);
    const hp = $('practice-companion'); if (hp && hp.offsetParent !== null) renderCompanion(hp);
    if (typeof currentPage !== 'undefined' && currentPage === 'skin' && typeof renderSkinRoom === 'function') renderSkinRoom();
  } catch (e) {}
});

/* =========================================================================
   三、皮肤小屋（所有皮肤免费直接换）
   ========================================================================= */
function renderSkinRoom(){
  const host = $('skin-host');
  if (!host) return;
  host.innerHTML = '';

  host.appendChild(sectionTitle('🧊 魔方皮肤 · 特效（背后光晕/粒子，保留六面基础色）'));
  const fg = el('div','skin-grid');
  Object.keys(SKINS.cube).filter(id => !SKINS.cube[id].theme).forEach(id => fg.appendChild(skinCard('cube', id)));
  host.appendChild(fg);

  host.appendChild(sectionTitle('🌈 魔方皮肤 · 主题（每面主题贴图，无光晕）'));
  const tg = el('div','skin-grid');
  Object.keys(SKINS.cube).filter(id => !!SKINS.cube[id].theme).forEach(id => tg.appendChild(skinCard('cube', id)));
  host.appendChild(tg);

  host.appendChild(sectionTitle('🤖 玩伴皮肤（3D 分层展示 · 高还原角色）'));
  const pg = el('div','skin-grid');
  Object.keys(SKINS.comp).forEach(id => pg.appendChild(skinCard('comp', id)));
  host.appendChild(pg);
}

function sectionTitle(txt){
  const h = el('h2');
  h.textContent = txt;
  return h;
}

function skinCard(kind, id){
  const sk = SKINS[kind][id];
  const equipped = (kind === 'cube' ? store.skins.cube : store.skins.comp) === id;

  const card = el('div','skin-card' + (equipped ? ' on' : ''));
  card.appendChild(el('div','skin-sub', sk.name));

  if (kind === 'cube'){
    const pv = el('div','skin-cube');
    card.appendChild(pv);
    setTimeout(() => drawSkinPreview(pv, id), 0);
    if (sk.fx && CUBE_EFFECTS[sk.fx] && CUBE_EFFECTS[sk.fx].desc){
      card.appendChild(el('div','skin-desc', CUBE_EFFECTS[sk.fx].desc));
    } else if (sk.desc){
      card.appendChild(el('div','skin-desc', sk.desc));
    }
  } else {
    const wrap = el('div','skin-comp');
    wrap.innerHTML = companion3DMarkup(id, true);
    card.appendChild(wrap);
    setTimeout(() => {
      const mhost = wrap.querySelector('.m3d-host');
      if (mhost) mountCompanion3D(mhost, id, true);
      else { const st = wrap.querySelector('.stage3d'); if (st) mountStage3D(st); }
    }, 0);
  }

  card.appendChild(el('div','skin-name', sk.name));

  const row = el('div','skin-actions');
  if (equipped){
    row.appendChild(el('span','tag equipped','✅ 正在使用'));
  } else {
    const b = el('button','btn green sm','换上');
    b.onclick = () => equipSkin(kind, id);
    row.appendChild(b);
  }
  card.appendChild(row);
  return card;
}

/* 用某个皮肤（特效或主题）画一个小预览（始终保留经典六色），画完还原当前状态 */
function drawSkinPreview(node, id){
  if (typeof drawCube !== 'function') return;
  const sk = SKINS.cube[id];
  const prevFx = CUBE_FX, prevTheme = CUBE_THEME;
  CUBE_FX = sk.fx || null;
  CUBE_THEME = sk.theme || null;
  drawCube(node, solvedCube(), {});
  CUBE_FX = prevFx;
  CUBE_THEME = prevTheme;
}
