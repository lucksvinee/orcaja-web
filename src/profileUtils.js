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
  email: user.email,
  role: 'tenant',
  status: 'trialing',
  plan: 'trial',
  trial_ends_at: getTrialEndsAt(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

export const ensureTenantProfile = async (db, user) => {
  const profileRef = doc(db, 'profiles', user.uid);
  const profileSnap = await getDoc(profileRef);

  if (profileSnap.exists()) {
    return profileSnap.data();
  }

  const trialProfile = buildTrialProfile(user);

  try {
    await setDoc(profileRef, trialProfile);
    return trialProfile;
  } catch (error) {
    const refreshedProfileSnap = await getDoc(profileRef);

    if (refreshedProfileSnap.exists()) {
      return refreshedProfileSnap.data();
    }

    throw error;
  }
};
