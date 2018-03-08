import * as Arc from '@daostack/arc.js';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Link, RouteComponentProps } from 'react-router-dom'
import { connect } from 'react-redux';
import { CSSTransition } from 'react-transition-group';

import * as arcActions from 'actions/arcActions';
import { IRootState } from 'reducers';
import { IWeb3State } from 'reducers/web3Reducer'

import * as css from "./Errors.scss"

interface IStateProps {
  web3State: IWeb3State
}

const mapStateToProps = (state : IRootState, ownProps: any) => {
  return {
    web3State: state.web3
  };
};

interface IDispatchProps {
  connectToArc: typeof arcActions.connectToArc
}

const mapDispatchToProps = {
  connectToArc: arcActions.connectToArc
};

type IProps = IStateProps & IDispatchProps

class NoWeb3Container extends React.Component<IProps, null> {
  interval : any;

  componentDidMount() {
    this.interval = setInterval(this.props.connectToArc, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    return(
      <div className={css.wrapper}>
        <div className={css.notification}>
          <img src="/assets/images/metamask.png"/>
          <h1>You are not connected to Web3. Please install MetaMask.</h1>
          <a className={css.downloadMetamask} href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn">Add MetamMask from the Chrome Web Store</a>
        </div>
      </div>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(NoWeb3Container);