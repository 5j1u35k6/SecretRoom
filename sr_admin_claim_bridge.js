const APP_ID = 'secretg-production-node-tw';

async function verify(adminId) {
  const [appMod, authMod, firestoreMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
  ]);

  const app = appMod.getApps()[0];
  if (!app) return null;

  const user = authMod.getAuth(app).currentUser;
  if (!user) return null;

  const token = await authMod.getIdTokenResult(user, true);
  if (token.claims.secretroomAdmin !== true) return null;
  if (String(token.claims.secretroomAdminId || '') !== String(adminId || '')) return null;

  const snapshot = await firestoreMod.getDoc(
    firestoreMod.doc(firestoreMod.getFirestore(app), 'secretg_apps', APP_ID, 'admins', adminId)
  );
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  if (data.enabled === false) return null;
  const allowed = data.role === 'admin' || data.isAdmin === true || data.canAdmin === true || data.adminApproved === true;
  return allowed ? data : null;
}

window.SRAdminClaimBridge = Object.freeze({ verify });
