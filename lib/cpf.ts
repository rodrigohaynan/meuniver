export function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const numbers = value.split("").map(Number);
  const check = (factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i += 1) total += numbers[i] * (factor - i);
    const result = (total * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return check(10) === numbers[9] && check(11) === numbers[10];
}
