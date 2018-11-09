import * as Arc from "@daostack/arc.js";
import promisify = require("es6-promisify");
import * as ethUtil from 'ethereumjs-util';
import * as sigUtil from 'eth-sig-util';
import { Formik, Field, FormikBag } from 'formik';
import * as queryString from 'query-string';
import * as React from "react";
import { connect, Dispatch } from "react-redux";
import { Link, RouteComponentProps } from "react-router-dom";

import * as profileActions from "actions/profilesActions";
import { IRootState } from "reducers";
import { IAccountState, IDaoState } from "reducers/arcReducer";
import { NotificationStatus, showNotification } from "reducers/notifications";
import { IProfileState } from "reducers/profilesReducer";
import Util from "lib/util";

import AccountImage from "components/Account/AccountImage";
import ReputationView from "components/Account/ReputationView";

import * as css from "./Account.scss";

interface IStateProps extends RouteComponentProps<any> {
  accountAddress: string;
  currentAccountInfo?: IAccountState;
  currentAccountProfile?: IProfileState;
  dao?: IDaoState;
}

const mapStateToProps = (state: IRootState, ownProps: any) => {
  const queryValues = queryString.parse(ownProps.location.search);

  return {
    accountAddress: state.web3.ethAccountAddress,
    currentAccountInfo: state.arc.accounts[state.web3.ethAccountAddress + "-" + queryValues.daoAvatarAddress],
    currentAccountProfile: state.profiles[state.web3.ethAccountAddress],
    dao: queryValues.daoAvatarAddress ? state.arc.daos[queryValues.daoAvatarAddress as string] : null
  };
};

interface IDispatchProps {
  showNotification: typeof showNotification;
  updateProfile: typeof profileActions.updateProfile;
}

const mapDispatchToProps = {
  showNotification,
  updateProfile: profileActions.updateProfile
};

type IProps = IStateProps & IDispatchProps;

interface IState {
  genCount: number;
  ethCount: number;
}

interface FormValues {
  description: string;
  githubURL: string;
  name: string;
}

class AccountProfileContainer extends React.Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      ethCount: null,
      genCount: null
    };
  }

  public async componentWillMount() {
    const { accountAddress, dao } = this.props;
    const web3 = await Arc.Utils.getWeb3();
    const getBalance = promisify(web3.eth.getBalance);
    const ethBalance = await getBalance(accountAddress);

    let votingMachineInstance: Arc.GenesisProtocolWrapper;
    if (dao) {
      const contributionRewardInstance = await Arc.ContributionRewardFactory.deployed();
      const votingMachineAddress = (await contributionRewardInstance.getSchemeParameters(dao.avatarAddress)).votingMachineAddress;
      votingMachineInstance = await Arc.GenesisProtocolFactory.at(votingMachineAddress);
    } else {
      votingMachineInstance = await Arc.GenesisProtocolFactory.deployed();
    }
    const stakingTokenAddress = await votingMachineInstance.contract.stakingToken();
    const stakingToken = await (await Arc.Utils.requireContract("StandardToken")).at(stakingTokenAddress) as any;
    const genBalance = await stakingToken.balanceOf(accountAddress);

    this.setState({ ethCount: Util.fromWei(ethBalance), genCount: Util.fromWei(genBalance)});
  }

  public copyAddress = () => {
    const { showNotification, accountAddress } = this.props;
    Util.copyToClipboard(accountAddress);
    showNotification(NotificationStatus.Success, `Copied to clipboard!`);
  }

  public async handleSubmit(values: FormValues, { props, setSubmitting, setErrors }: any ) {
    const { accountAddress, updateProfile } = this.props;

    const web3 = await Arc.Utils.getWeb3();
    const text = "Please sign in to Alchemy";
    const msg = ethUtil.bufferToHex(Buffer.from(text, 'utf8'));
    const fromAddress = this.props.accountAddress;

    let signature = localStorage.getItem("signature");
    if (!signature) {
      const method = 'personal_sign';
      const sendAsync = promisify(web3.currentProvider.sendAsync);
      const params = [msg, fromAddress];
      const result = await sendAsync({ method, params, fromAddress });
      signature = result.result;
      localStorage.setItem("signature", signature);
    }

    const recoveredAddress = sigUtil.recoverPersonalSignature({ data: msg, sig: signature });

    if (recoveredAddress == this.props.accountAddress) {
      await updateProfile(accountAddress, values.name, values.description, signature);
    } else {
      console.error("Signing in failed, please ensure you are logged in to MetaMask with an address that you own");
    }
    setSubmitting(false);
  }

  public render() {
    const { accountAddress, currentAccountInfo, currentAccountProfile, dao } = this.props;
    const { ethCount, genCount } = this.state;

    const hasProfile = currentAccountProfile && currentAccountProfile.name;

    return (
      <div className={css.profileContainer}>
         <h3>{ currentAccountProfile && currentAccountProfile.name ? "Edit Profile" : "Set Profile"}</h3>
         { typeof(currentAccountProfile) === 'undefined' ? "Loading..." :
            <Formik
              initialValues={{
                description: currentAccountProfile ? currentAccountProfile.description || "" : "",
                githubURL: currentAccountProfile ? currentAccountProfile.githubURL || "" : "",
                name: currentAccountProfile ? currentAccountProfile.name || "" : ""
              } as FormValues}
              validate={(values: FormValues) => {
                const { name } = values;
                const errors: any = {};

                const require = (name: string) => {
                  if (!(values as any)[name]) {
                    errors[name] = 'Required';
                  }
                };

                require('name');

                return errors;
              }}
              onSubmit={this.handleSubmit.bind(this)}
              render={({
                values,
                errors,
                touched,
                handleChange,
                handleBlur,
                handleSubmit,
                isSubmitting,
                isValid,
              }) =>
                <form onSubmit={handleSubmit} noValidate>
                <div className={css.profileContent}>
                  <div className={css.userAvatarContainer}>
                    <AccountImage accountAddress={accountAddress} />
                  </div>
                  <div className={css.profileDataContainer}>
                    <label htmlFor="nameInput">
                      Real Name:&nbsp;
                    </label>
                    <Field
                      autoFocus
                      id="nameInput"
                      placeholder="e.g. John Doe"
                      name='name'
                      type="text"
                      className={touched.name && errors.name ? css.error : null}
                    />
                    {touched.name && errors.name && <span className={css.errorMessage}>{errors.name}</span>}
                    <br />
                    <br />
                    <label htmlFor="descriptionInput">
                      Personal Description:&nbsp;
                    </label>
                    <Field
                      id="descriptionInput"
                      placeholder="Tell the DAO a bit about yourself"
                      name='description'
                      component="textarea"
                      maxLength="150"
                      rows="7"
                      className={touched.description && errors.description ? css.error : null}
                    />
                    <div className={css.charLimit}>Limit 150 characters</div>
                  </div>
                  <div className={css.otherInfoContainer}>
                    <div className={css.tokens}>
                      {currentAccountInfo
                         ? <div><strong>Rep. Score</strong><br/><ReputationView reputation={currentAccountInfo.reputation} totalReputation={dao.reputationCount} daoName={dao.name}/> </div>
                         : ""}
                      <div><strong>GEN:</strong><br/><span>{genCount}</span></div>
                      <div><strong>ETH:</strong><br/><span>{ethCount}</span></div>
                    </div>
                    <div>
                      <strong>ETH Address:</strong><br/>
                      <span>{accountAddress.substr(0, 20)}...</span>
                      <button className={css.copyButton} onClick={this.copyAddress}><img src="/assets/images/Icon/Copy-black.svg"/></button>
                    </div>
                    <div>
                      <strong>Prove it's you by linking your social accounts:</strong>
                      <p>Authenticate your identity by linking your social accounts. Once linked, your social accounts will display in your profile page, and server as proof that you are who you say you are.</p>
                    </div>
                  </div>
                </div>
                <div className={css.alignCenter}>
                  <button className={css.submitButton} type="submit" disabled={isSubmitting}>
                    <img className={css.loading} src="/assets/images/Icon/Loading-black.svg"/>
                    SUBMIT
                  </button>
                </div>
                </form>
              }
            />
        }
      </div>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(AccountProfileContainer);