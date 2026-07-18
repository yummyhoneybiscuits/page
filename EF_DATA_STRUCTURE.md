# EF 数据结构与命名规范

本文档是修改 EF 价格数据时的唯一参考。

## 目录结构

```text
assets/data/ef/
├── manifest.json
└── categories/
    ├── updates.json
    ├── routine.json
    ├── main-story.json
    ├── side-quests.json
    ├── permanent-events.json
    └── world-exploration.json
```

`manifest.json` 是数据的唯一入口。`categoryFiles` 的数组顺序决定菜单、计价器和编辑器中的分类顺序。

## 通用命名规范

### ID

所有 ID 必须使用小写 kebab-case：

```text
main-story
main-story-01
main-story-01-option-01
routine-01-feature-01
```

规则：

- Category ID 与文件名一致，例如 `main-story.json` 使用 `main-story`。
- Item ID 使用 `<category-id>-NN`，例如 `main-story-01`。
- Option ID 使用 `<item-id>-option-NN`，例如 `main-story-01-option-01`。
- List Feature ID 使用 `<item-id>-feature-NN`，例如 `routine-01-feature-01`。
- `NN` 从 `01` 开始，并按照当前数组位置连续编号。
- Editor 在新增、删除和拖拽排序后自动重新编号。
- Item、Option、Feature 排序后 ID 会变化，包含旧 ID 的 v3 价格码会失效。

### 文件名

- JSON 文件名使用小写 kebab-case。
- 分类文件名应与分类 ID 相同。例如 `main-story.json` 内的根 ID 应为 `main-story`。
- 分类路径相对于 `assets/data/ef/manifest.json`。

### 显示文字

- `name`：主要显示名称。
- `description`：次要说明文字。
- ID 中不要写显示文字或中文。
- 如果只是调整页面文案，只修改 `name` 或 `description`，不要修改 ID。

### 数值

- `price` 和 `unitPrice` 必须是 JSON 数字，不能写成字符串。
- 价格必须大于或等于 `0`。
- `maxQuantity` 必须是大于 `0` 的整数。
- `multiplier` 必须大于 `0` 且小于或等于 `1`。
- Option 的 `description` 是可选显示文本，只替换页面上的价格位置，不参与计算。

## Manifest

文件：`assets/data/ef/manifest.json`

```json
{
  "currencycode": "CNY",
  "currencysymbol": "¥",
  "categoryFiles": [
    {
      "id": "updates",
      "path": "categories/updates.json"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `currencycode` | string | 三位货币代码，当前为 `CNY`。 |
| `currencysymbol` | string | 页面显示的货币符号。 |
| `categoryFiles` | array | 有序分类文件列表。 |
| `categoryFiles[].id` | ID | 必须与分类文件根 ID 相同。 |
| `categoryFiles[].path` | string | 相对分类文件路径。 |

## Category

```json
{
  "id": "main-story",
  "name": "主线剧情任务",
  "badge": "NEW!",
  "Expanded": true,
  "items": []
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 全局唯一分类 ID。 |
| `name` | 是 | 分类显示名称。 |
| `badge` | 否 | 分类角标，不需要时删除该字段。 |
| `Expanded` | 是 | 计价器首次加载时是否展开。 |
| `items` | 是 | 有序 Item 数组，数组顺序就是显示顺序。 |

## Item 类型

只允许以下四种 `kind`：

```text
Item
Items
List
Formula
```

## Item

用于一个可以直接选择、价格固定的服务。

```json
{
  "kind": "Item",
  "id": "main-story-01",
  "name": "序章",
  "price": 15,
  "maxQuantity": 1
}
```

| 字段 | 说明 |
| --- | --- |
| `kind` | 固定为 `Item`。 |
| `id` | 全局唯一 Item ID。 |
| `name` | 显示名称。 |
| `price` | 单价。 |
| `maxQuantity` | 购物车最大数量。 |

## Items

用于包含多个可独立选择 Option 的项目。

```json
{
  "kind": "Items",
  "id": "main-story-03",
  "name": "第一章进程一",
  "description": "[1.0]到罗丹boss",
  "presentation": "collapsible",
  "headerPrice": "selected",
  "Expanded": false,
  "options": [
    {
      "id": "main-story-03-option-01",
      "name": "基地解围",
      "price": 5
    }
  ]
}
```

`presentation` 只能使用：

| 值 | 说明 |
| --- | --- |
| `collapsible` | 可折叠 Option Group，原 Dropdown。 |
| `inline` | 直接显示 Option，原 Choices。 |

### 表头价格

`headerPrice` 可选值：

| 值 | 说明 |
| --- | --- |
| `total` | 默认显示全部 Option 的总价；选择 Option 后显示当前已选 Option 的实时总价。省略字段时使用此值。 |
| `selected` | 显示当前已选 Option 的实时总价；没有选择时表头价格位置留空，Editor 的 Price 也留空并禁用。 |

可选的 `price` 是选中全部 Option 时使用的固定总价：

```json
{
  "price": 95
}
```

- `price` 留空或省略时，根据已选 Option 和折扣规则动态计算。
- `headerPrice` 为 `selected` 时不使用也不导出 `price`。
- `price` 只在全部 Option 被选中时生效，并优先于折扣规则。

### 折扣规则

指定 Option 组合折扣：

```json
{
  "type": "combination",
  "optionIds": [
    "main-story-03-option-01",
    "main-story-03-option-02"
  ],
  "label": "COMBO",
  "multiplier": 0.9
}
```

达到所选商品金额门槛后折扣：

```json
{
  "type": "threshold",
  "minimumPrice": 100,
  "label": "OVER 100",
  "multiplier": 0.85
}
```

规则放在 Items 的 `discountRules` 数组中：

```json
{
  "discountRules": []
}
```

- `combination`：列出的 Option 全部选中时，只对这些 Option 应用倍率。
- `threshold`：当前 Items 已选 Option 原价小计达到 `minimumPrice` 时，对当前已选 Option 应用倍率。
- `multiplier` 必须大于 `0` 且小于或等于 `1`，例如 `0.9` 表示九折。
- 多条规则同时命中时，每个 Option 使用对它最优惠的倍率，不重复叠乘。
- Editor 在 Option 排序后会同步更新组合规则中的 Option ID。

## Option

```json
{
  "id": "routine-02-option-01",
  "name": "种地",
  "price": 15,
  "description": "15￥/月"
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 全局唯一 Option ID。 |
| `name` | 是 | Option 显示名称。 |
| `price` | 是 | 参与计算的数值价格。 |
| `description` | 否 | 价格位置的自定义显示文本。 |

Option `description` 规则：

- 不写或留空时，页面正常显示格式化价格，例如 `¥15`。
- 写入后，页面价格位置直接显示 `description`，例如 `15￥/月`、`时价`、`联系客服`。
- Option 的 `description` 不会改变购物车、总价或折扣计算，计算始终使用 `price`。
- `description` 中需要显示的货币符号、单位和说明必须完整写出，系统不会自动拼接。
- Items 根级 `description` 是 Items 的副标题；Option 内的 `description` 是价格位置替换文本，两者所在层级不同。

## List

用于套餐单选和 Feature 对照表。

```json
{
  "kind": "List",
  "id": "routine-01",
  "name": "套餐服务",
  "features": [
    {
      "id": "routine-01-feature-01",
      "name": "日活"
    },
    {
      "id": "routine-01-feature-02",
      "name": "周常"
    }
  ],
  "options": [
    {
      "id": "routine-01-option-01",
      "name": "基础体托",
      "price": 60,
      "description": "60￥/月",
      "includedFeatureIds": [
        "routine-01-feature-01",
        "routine-01-feature-02"
      ]
    }
  ]
}
```

规则：

- Feature ID 按照当前 `features` 数组位置编号。
- 只修改 Feature 的 `name` 不会改变 ID；调整 Feature 顺序会重新编号。
- `includedFeatureIds` 中的 ID 必须存在于同一个 List 的 `features` 中。
- `includedFeatureIds` 不允许重复。
- List Option 使用普通 Option 字段，并额外要求 `includedFeatureIds`。

## Formula

用于根据用户输入数量或已有进度计算价格。

```json
{
  "kind": "Formula",
  "id": "world-exploration-01",
  "name": "已拥有档案补全",
  "totalQuantity": 406,
  "unitPrice": 0.6,
  "minValue": 0,
  "maxValue": 406,
  "defaultValue": 0
}
```

计价公式：

```text
price = max(0, totalQuantity - inputValue) * unitPrice
```

规则：

- `maxValue` 必须大于或等于 `minValue`。
- `defaultValue` 必须位于 `minValue` 和 `maxValue` 之间。
- `totalQuantity` 和 `unitPrice` 必须大于或等于 `0`。

## 排序规则

所有排序都由数组顺序决定：

- Category：`manifest.json` 的 `categoryFiles`。
- Item：分类文件的 `items`。
- Option：Item 的 `options`。
- List Feature：List 的 `features`。
- List 已包含 Feature：List Option 的 `includedFeatureIds`。

Data Editor 可以调整这些数组顺序，下载的分类 JSON 仍使用本文档中的标准结构。

## 修改流程

1. 修改 `assets/data/ef/categories/` 下的分类文件，或使用 `editor.html`。
2. 所有 ID 保持全局唯一和 kebab-case。
3. 只使用四种有效 Item `kind`。
4. 数值字段必须写 JSON 数字。
5. 新增分类时，同时添加到 `manifest.json.categoryFiles`。
6. 手动修改 List Feature ID 或顺序时，同步修改所有引用它的 `includedFeatureIds`；使用 Editor 排序会自动同步。
7. 发布前通过页面 loader 的运行时校验检查数据。

## JavaScript 数据模块

```text
assets/js/
├── data-loader.js
├── data-normalize.js
└── data-render.js
```

- `loader.js`：加载并校验 v3 JSON，处理 editor 导出转换。
- `normalize.js`：建立计价器运行时索引和价格数据。
- `render.js`：渲染计价器数据。

EF 菜单脚本：

```text
assets/js/ef-menu.js
```

不要在 menu、calculator 或 editor 中新增另一套 loader，也不要重复实现数据转换。
