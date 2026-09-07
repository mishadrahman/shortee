import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, googleAuthProvider, db } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync user profile from Firestore or create on first sign-in
  const syncUserProfile = async (user: User | null) => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    // Set immediate basic profile so UI doesn't wait
    const defaultProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
      photoURL: user.photoURL,
      createdAt: new Date().toISOString(),
    };
    setUserProfile(defaultProfile);

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const snapshot = await getDoc(userDocRef);

      if (snapshot.exists()) {
        setUserProfile(snapshot.data() as UserProfile);
      } else {
        await setDoc(userDocRef, defaultProfile);
      }
    } catch (err) {
      console.warn('Could not sync user profile with Firestore:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Safety fallback timer to prevent infinite loading screen on reload
    const timer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 300);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      clearTimeout(timer);
      setCurrentUser(user);
      if (user) {
        syncUserProfile(user).catch(console.warn);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await syncUserProfile(cred.user);
  };

  const signUpWithEmail = async (email: string, pass: string, displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName && displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: displayName?.trim() || (cred.user.email ? cred.user.email.split('@')[0] : 'User'),
      photoURL: cred.user.photoURL,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
    } catch (err) {
      console.warn('Failed to set initial user doc in Firestore:', err);
    }
    setUserProfile(newProfile);
  };

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    await syncUserProfile(cred.user);
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateDisplayName = async (name: string) => {
    if (!currentUser) return;
    const trimmed = name.trim();
    await updateProfile(currentUser, { displayName: trimmed });
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { displayName: trimmed });
    } catch (err) {
      console.warn('Failed to update Firestore user doc:', err);
    }
    setUserProfile((prev) => (prev ? { ...prev, displayName: trimmed } : null));
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    logout,
    resetPassword,
    updateDisplayName,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
