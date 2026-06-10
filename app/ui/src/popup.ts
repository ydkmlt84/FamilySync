export function openCenteredPopup(
  url: string,
  title: string,
  width: number,
  height: number,
): Window | null {
  const dualScreenLeft = window.screenLeft ?? window.screenX;
  const dualScreenTop = window.screenTop ?? window.screenY;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || screen.width;
  const viewportHeight =
    window.innerHeight ||
    document.documentElement.clientHeight ||
    screen.height;
  const left = viewportWidth / 2 - width / 2 + dualScreenLeft;
  const top = viewportHeight / 2 - height / 2 + dualScreenTop;

  const popup = window.open(
    url,
    title,
    `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`,
  );

  popup?.focus();
  return popup;
}
