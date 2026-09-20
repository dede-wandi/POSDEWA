import re

with open('src/screens/DashboardScreen.js', 'r') as f:
    content = f.read()

styles_updates = {
    r'  header: \{[\s\S]*?zIndex: 10,\n  \},': """  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 16,
    zIndex: 10,
  },""",
    r'  searchBar: \{[\s\S]*?\},': """  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 99,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },""",
    r'  menuItem: \{[\s\S]*?\},': """  menuItem: {
    width: '23%',
    alignItems: 'center',
    marginBottom: 16,
  },""",
    r'  container: \{\n    flex: 1,\n    backgroundColor: Colors.background,\n  \},': """  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },"""
}

for old, new_s in styles_updates.items():
    content = re.sub(old, new_s, content)

with open('src/screens/DashboardScreen.js', 'w') as f:
    f.write(content)
