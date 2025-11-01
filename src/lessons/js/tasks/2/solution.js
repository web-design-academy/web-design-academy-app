const result = document.getElementById("result");
document.querySelectorAll(".option").forEach(btn => {
  btn.addEventListener("click", () => {
    result.textContent = "";

    if (btn.dataset.correct === "true") {
      result.textContent = "Correct!";
      result.style.color = "green";
    } else {
      result.textContent = "Incorrect!";
      result.style.color = "red";
    }
  });
});
