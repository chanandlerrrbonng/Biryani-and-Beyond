/**
 * authorize(...roles) → middleware that requires an authenticated user
 * whose role is in the allowed set. Must run AFTER authenticate.
 *
 * scopeFilter(req) → returns { merchantId, branchId } to be applied to
 * data queries so staff/owners only ever see their own tenant's rows.
 * Owners see their whole merchant; staff are additionally pinned to a branch
 * if their user record has one.
 */

function authorize(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
    next();
  };
}

function scopeFilter(req) {
  const { merchantId, branchId, role } = req.user || {};
  // Owners: scoped to their merchant, all branches (unless their record pins one).
  // Staff: scoped to their merchant AND their branch (if set).
  const scope = { merchantId: merchantId || null, branchId: null };
  if (role === 'staff' && branchId) scope.branchId = branchId;
  else if (branchId) scope.branchId = branchId;
  return scope;
}

module.exports = { authorize, scopeFilter };
