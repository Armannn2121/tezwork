import { useRouter } from 'expo-router';
import { useFeedback } from './feedback';
import { t } from './i18n';
import { useSession } from './session';

// Жазылар (жұмысшы) немесе жарияламас (бизнес) бұрын ЖСН бар-жоғын тексереді; жоқ болса — профильге жібереді
export function useIinGate() {
  const router = useRouter();
  const { iin, profile } = useSession();
  const { confirm } = useFeedback();
  return async (force = false) => {
    if (iin && !force) return true;
    const ok = await confirm({
      title: t('iin.required'),
      message: t(profile?.role === 'business' ? 'iin.requiredMsgEmployer' : 'iin.requiredMsg'),
      confirm: t('iin.add'),
      cancel: t('common.cancel'),
    });
    if (ok) router.push('/profile-edit');
    return false;
  };
}
