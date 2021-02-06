import React from 'react'
import { GU, Link, useTheme, useViewport } from '@1hive/1hive-ui'
import AccountModule from '../Account/AccountModule'
import Layout from '../Layout'

import logoSvg from '../../assets/logo.svg'

function Header() {
  const theme = useTheme()
  const { below } = useViewport()
  const layoutSmall = below('medium')

  return (
    <header
      css={`
        position: relative;
        z-index: 3;
        background: #fff;
        box-shadow: rgba(0, 0, 0, 0.05) 0 2px 3px;
      `}
    >
      <Layout paddingBottom={0}>
        <div
          css={`
            height: ${8 * GU}px;
            margin: 0 ${3 * GU}px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          `}
        >
          <div
            css={`
              display: flex;
              align-items: center;
            `}
          >
            <Link href="#/home" external={false}>
              <img src={logoSvg} height="28" alt="" />
            </Link>
            {!below('large') && (
              <nav
                css={`
                  display: flex;
                  align-items: center;

                  height: 100%;
                  margin-left: ${6.5 * GU}px;
                `}
              >
                <Link
                  href="#/home"
                  external={false}
                  css={`
                    text-decoration: none;
                    color: ${theme.contentSecondary};
                  `}
                >
                  Parties
                </Link>
              </nav>
            )}
          </div>

          <div
            css={`
              display: flex;
              align-items: center;
              ${!layoutSmall && `min-width: ${42.5 * GU}px`};
            `}
          >
            <AccountModule compact={layoutSmall} />
          </div>
        </div>
      </Layout>
    </header>
  )
}

export default Header