import './index.sass';
import React from 'react';

interface TopMaoProps {
    currentScrollHeight: number;
}

const TopMao: React.FC<TopMaoProps> = ({ currentScrollHeight }) => {
    const BackToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };
    return (
        <div className={`TopMao ${currentScrollHeight > 500 ? 'TopMaoShow' : ''} shake`} role="button" tabIndex={0} aria-label="猫咪：回到顶部" onClick={BackToTop} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); BackToTop(); } }}></div>
    );
};

export default TopMao;
