import React, { useEffect } from 'react';
import { setCurrentPage } from '../admin-main-window/current-page-slice';
import { useAppDispatch } from '../../../../app/hooks';

export const NoPage: React.FC = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setCurrentPage(
      {
        pageName: 'Missing Page',
        pageCode: 'nopage',
        pageUrl: window.location.pathname,
        routePath: '',        
      }));
  }, []);

  
  return (
    <>
      No Such page
    </>
  );
}