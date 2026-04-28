(() => {
  const target = document.querySelector("[data-hero-poem]");
  if (!target) return;

  const poems = [
    "行到水穷处，坐看云起时。",
    "明月松间照，清泉石上流。",
    "采菊东篱下，悠然见南山。",
    "大漠孤烟直，长河落日圆。",
    "海内存知己，天涯若比邻。",
    "落霞与孤鹜齐飞，秋水共长天一色。",
    "浮云游子意，落日故人情。",
    "山重水复疑无路，柳暗花明又一村。",
    "长风破浪会有时，直挂云帆济沧海。",
    "云想衣裳花想容，春风拂槛露华浓。",
    "欲穷千里目，更上一层楼。",
    "松风吹解带，山月照弹琴。",
    "人生如逆旅，我亦是行人。",
  ];

  const pick = poems[Math.floor(Math.random() * poems.length)];
  if (!pick) return;
  target.textContent = pick;
})();
