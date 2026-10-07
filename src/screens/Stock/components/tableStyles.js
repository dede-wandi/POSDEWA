import { StyleSheet, Platform } from 'react-native';

/** Shared Excel-style spreadsheet styles for stock tables. */
export const tableStyles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  scroll: { width: '100%' },
  scrollContent: { minWidth: '100%', flexGrow: 1 },
  container: { width: '100%', minWidth: 860, flex: 1 },

  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1.5,
    borderBottomColor: '#94A3B8',
    minHeight: 38,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
  },
  headerText: { fontSize: 11, fontWeight: '800', color: '#334155', letterSpacing: 0.3 },

  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    minHeight: 38,
  },
  rowEven: { backgroundColor: '#FFFFFF' },
  rowOdd: { backgroundColor: '#F8FAFC' },
  rowParent: { borderBottomWidth: 1.5, borderBottomColor: '#CBD5E1' },
  rowVariant: { backgroundColor: '#F8FAFC', borderLeftColor: '#0284C7', minHeight: 34 },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  center: { alignItems: 'center' },
  right: { alignItems: 'flex-end' },
  lastCol: { borderRightWidth: 0 },

  noText: { fontSize: 11, color: '#64748B', fontWeight: '600', textAlign: 'center' },
  subNoText: { fontSize: 10, color: '#94A3B8', fontWeight: '700', textAlign: 'center' },
  nameText: { fontSize: 12.5, fontWeight: '700', color: '#0F172A' },
  codeText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillText: { fontSize: 11, fontWeight: '700' },
  grayPill: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderRadius: 6 },
  grayPillText: { fontSize: 11, fontWeight: '600', color: '#475569' },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#475569', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
});
