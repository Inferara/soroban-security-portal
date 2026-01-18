import { describe, it, expect } from 'vitest';
import currentPageReducer, {
  setCurrentPage,
  selectCurrentPage,
  CurrentPageState,
} from '../current-page-slice';

describe('currentPageSlice', () => {
  const initialState: CurrentPageState = {
    pageName: '',
    pageCode: '',
    pageUrl: '',
    routePath: '',
  };

  describe('reducer', () => {
    it('returns initial state', () => {
      const result = currentPageReducer(undefined, { type: 'unknown' });
      expect(result).toEqual(initialState);
    });

    it('handles setCurrentPage action', () => {
      const newPageState: CurrentPageState = {
        pageName: 'Users',
        pageCode: 'users',
        pageUrl: '/admin/users',
        routePath: 'admin/users',
      };

      const result = currentPageReducer(initialState, setCurrentPage(newPageState));

      expect(result).toEqual(newPageState);
    });

    it('replaces all page properties', () => {
      const previousState: CurrentPageState = {
        pageName: 'Old Page',
        pageCode: 'old',
        pageUrl: '/old',
        routePath: 'old',
      };

      const newPageState: CurrentPageState = {
        pageName: 'New Page',
        pageCode: 'new',
        pageUrl: '/new',
        routePath: 'new',
      };

      const result = currentPageReducer(previousState, setCurrentPage(newPageState));

      expect(result.pageName).toBe('New Page');
      expect(result.pageCode).toBe('new');
      expect(result.pageUrl).toBe('/new');
      expect(result.routePath).toBe('new');
    });
  });

  describe('actions', () => {
    it('setCurrentPage creates correct action', () => {
      const pageState: CurrentPageState = {
        pageName: 'Settings',
        pageCode: 'settings',
        pageUrl: '/admin/settings',
        routePath: 'admin/settings',
      };

      const action = setCurrentPage(pageState);

      expect(action.type).toBe('currentPageInfo/setCurrentPage');
      expect(action.payload).toEqual(pageState);
    });
  });

  describe('selectors', () => {
    it('selectCurrentPage returns current page state', () => {
      const state = {
        currentPage: {
          pageName: 'Vulnerabilities',
          pageCode: 'vulnerabilities',
          pageUrl: '/admin/vulnerabilities',
          routePath: 'admin/vulnerabilities',
        },
        error: { message: null },
      };

      const result = selectCurrentPage(state);

      expect(result).toEqual(state.currentPage);
    });
  });

  describe('page scenarios', () => {
    it('handles Users page', () => {
      const usersPage: CurrentPageState = {
        pageName: 'Users',
        pageCode: 'users',
        pageUrl: '/admin/users',
        routePath: 'admin/users',
      };

      const result = currentPageReducer(initialState, setCurrentPage(usersPage));
      expect(result.pageName).toBe('Users');
    });

    it('handles Vulnerabilities page', () => {
      const vulnerabilitiesPage: CurrentPageState = {
        pageName: 'Vulnerabilities',
        pageCode: 'vulnerabilities',
        pageUrl: '/admin/vulnerabilities',
        routePath: 'admin/vulnerabilities',
      };

      const result = currentPageReducer(initialState, setCurrentPage(vulnerabilitiesPage));
      expect(result.pageName).toBe('Vulnerabilities');
    });

    it('handles Reports page', () => {
      const reportsPage: CurrentPageState = {
        pageName: 'Reports',
        pageCode: 'reports',
        pageUrl: '/admin/reports',
        routePath: 'admin/reports',
      };

      const result = currentPageReducer(initialState, setCurrentPage(reportsPage));
      expect(result.pageName).toBe('Reports');
    });

    it('handles Auditors page', () => {
      const auditorsPage: CurrentPageState = {
        pageName: 'Auditors',
        pageCode: 'auditors',
        pageUrl: '/admin/auditors',
        routePath: 'admin/auditors',
      };

      const result = currentPageReducer(initialState, setCurrentPage(auditorsPage));
      expect(result.pageName).toBe('Auditors');
    });

    it('handles Protocols page', () => {
      const protocolsPage: CurrentPageState = {
        pageName: 'Protocols',
        pageCode: 'protocols',
        pageUrl: '/admin/protocols',
        routePath: 'admin/protocols',
      };

      const result = currentPageReducer(initialState, setCurrentPage(protocolsPage));
      expect(result.pageName).toBe('Protocols');
    });

    it('handles Companies page', () => {
      const companiesPage: CurrentPageState = {
        pageName: 'Companies',
        pageCode: 'companies',
        pageUrl: '/admin/companies',
        routePath: 'admin/companies',
      };

      const result = currentPageReducer(initialState, setCurrentPage(companiesPage));
      expect(result.pageName).toBe('Companies');
    });

    it('handles Tags page', () => {
      const tagsPage: CurrentPageState = {
        pageName: 'Tags',
        pageCode: 'tags',
        pageUrl: '/admin/tags',
        routePath: 'admin/tags',
      };

      const result = currentPageReducer(initialState, setCurrentPage(tagsPage));
      expect(result.pageName).toBe('Tags');
    });
  });
});
