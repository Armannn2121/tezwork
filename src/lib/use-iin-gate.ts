import { useRouter } from 'expo-router';
import { useFeedback } from './feedback';
import { t } from './i18n';
import { useSession } from './session';

// Жазылар алдында ЖСН бар-жоғын тексереді; жоқ болса — профильге жібереді
export function useIinGate() {
  const router = useRouter();
  const { iin } = useSession();
  const { confirm } = useFeedback();
  return async (force = false) => {
    if (iin && !force) return true;
    const ok = await confirm({ title: t('iin.required'), message: t('iin.requiredMsg'), confirm: t('iin.add'), cancel: t('common.cancel') });
    if (ok) router.push('/profile-edit');
    return false;
  };
}
