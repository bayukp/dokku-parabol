import React, {PropTypes} from 'react';
import {connect} from 'react-redux';
import {cashay} from 'cashay';
import requireAuth from 'universal/decorators/requireAuth/requireAuth';
import {DashLayout, DashSidebar} from 'universal/components/Dashboard';
import Preferences from 'universal/modules/userDashboard/components/Settings/Settings';
import {getUserAndMemberships, queryOpts} from 'universal/modules/userDashboard/helpers/getUserAndMemberships';

const mapStateToProps = (state) => ({
  activity: state.userDashboardSettings.activity,
  nextPage: state.userDashboardSettings.nextPage,
  user: cashay.query(getUserAndMemberships, queryOpts).data.user
});

const MeSettingsContainer = (props) => {
  const {dispatch, user, ...otherProps} = props;
  return (
    <DashLayout title="My Dashboard">
      <DashSidebar activeArea="settings" dispatch={dispatch} user={user} />
      <Preferences user={user} {...otherProps} />
    </DashLayout>
  );
};

MeSettingsContainer.propTypes = {
  activity: PropTypes.string,
  dispatch: PropTypes.func.isRequired,
  nextPage: PropTypes.string,
  user: PropTypes.shape({
    name: PropTypes.string,
    memberships: PropTypes.array,
    preferredName: PropTypes.string
  })
};

export default connect(mapStateToProps)(requireAuth(MeSettingsContainer));
