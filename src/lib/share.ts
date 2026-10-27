import { Platform, Share } from 'react-native';

// Мәтінмен бөлісу. Телефонда — жүйелік терезе. Компьютердегі браузерлердің көбінде ондай терезе жоқ,
// сондықтан мәтінді көшіреміз ('copied'); Clipboard API бұғатталса — ескі execCommand тәсілі.
export async function shareText(message: string): Promise<'shared' | 'copied' | 'failed'> {
  if (Platform.OS !== 'web' || typeof navigator?.share === 'function') {
    try {
      await Share.share({ message });
      return 'shared';
    } catch {
      if (Platform.OS !== 'web') return 'failed';
    }
  }
  try {
    await navigator.clipboard.writeText(message);
    return 'copied';
  } catch {
    // төменде
  }
  try {
    const el = document.createElement('textarea');
    el.value = message;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
