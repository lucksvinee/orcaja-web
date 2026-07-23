import { Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';

export const TRIAL_DAYS = 14;

export const getTrialEndsAtDate = () => {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  return trialEndsAt;
};

export const getTrialEndsAt = () => Timestamp.fromDate(getTrialEndsAtDate());

export const getProfileDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') {
    return new Date((value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000));
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export const getTrialEndsAtFromProfile = (profile) => getProfileDate(profile?.trial_ends_at);

export const getAuthEmail = (user) => (
  user?.email
  || user?.providerData?.find((provider) => provider.email)?.email
  || ''
).trim();

export const isTrialExpired = (profile, now = new Date()) => {
  if (profile?.status !== 'trialing') return false;

  const trialEndsAt = getTrialEndsAtFromProfile(profile);
  return !trialEndsAt || trialEndsAt.getTime() <= now.getTime();
};

export const hasTenantAccess = (profile, now = new Date()) => {
  if (!profile || profile.role !== 'tenant') return false;
  if (profile.status === 'active') return true;
  if (profile.status === 'trialing') return !isTrialExpired(profile, now);
  return false;
};

export const getTenantBlockReason = (profile, now = new Date()) => {
  if (!profile || profile.role !== 'tenant') return null;
  if (profile.status === 'trialing' && isTrialExpired(profile, now)) return 'trial_expired';
  if (profile.status === 'blocked') return 'blocked';
  if (profile.status === 'cancelled') return 'cancelled';
  if (!hasTenantAccess(profile, now)) return 'inactive';
  return null;
};

export const buildTrialProfile = (user) => ({
  email: getAuthEmail(user),
  role: 'tenant',
  status: 'trialing',
  plan: 'trial',
  trial_ends_at: getTrialEndsAt(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const getProfileAccessError = (error) => {
  if (error?.code !== 'permission-denied') return error;

  const accessError = new Error(
    'Login confirmado, mas o perfil do usuário não pôde ser criado no Firestore. Publique as regras atualizadas do Firebase e tente novamente.'
  );
  accessError.code = error.code;
  accessError.cause = error;
  return accessError;
};

export const ensureTenantProfile = async (db, user) => {
  try {
    const profileRef = doc(db, 'profiles', user.uid);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      return profileSnap.data();
    }

    const trialProfile = buildTrialProfile(user);

    await setDoc(profileRef, trialProfile);
    return trialProfile;
  } catch (error) {
    try {
      const profileRef = doc(db, 'profiles', user.uid);
      const refreshedProfileSnap = await getDoc(profileRef);

      if (refreshedProfileSnap.exists()) {
        return refreshedProfileSnap.data();
      }
    } catch {
      // Keep the original write/read error so the UI can show the real cause.
    }

    throw getProfileAccessError(error);
  }
};
