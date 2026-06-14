import { doc, getDoc, setDoc } from 'firebase/firestore';

export const getTrialEndsAt = () => {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);
  return trialEndsAt.toISOString();
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
