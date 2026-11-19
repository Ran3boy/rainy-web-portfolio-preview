// Selection and panel size are native/CSS. Moving keyboard focus should never reposition the page.
(() => {
  const group = document.querySelector("[data-services] .sd-list");
  if (!group) return;
  const choices = [...group.querySelectorAll('input[type="radio"]')];

  group.addEventListener("keydown", (event) => {
    const index = choices.indexOf(event.target);
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return;

    let next;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp": next = (index + choices.length - 1) % choices.length; break;
      case "ArrowRight":
      case "ArrowDown": next = (index + 1) % choices.length; break;
      case "Home": next = 0; break;
      case "End": next = choices.length - 1; break;
      case "Enter": next = index; break;
      default: return;
    }
    event.preventDefault();
    choices[next].focus({ preventScroll: true });
    choices[next].click();
  });
})();
