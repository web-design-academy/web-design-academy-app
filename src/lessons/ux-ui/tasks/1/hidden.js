document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const targetId = a.getAttribute("href").substring(1);
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return;

    a.addEventListener("click", e => {
      e.preventDefault();
      targetElement.scrollIntoView({ behavior: "smooth" });
    });
  });
});
