import {GraphQLList, GraphQLNonNull, GraphQLObjectType} from 'graphql'
import StandardMutationError from 'server/graphql/types/StandardMutationError'
import Team from 'server/graphql/types/Team'
import {getUserId, isSuperUser} from '../../utils/authorization'
import AtlassianAuth from './AtlassianAuth'
import AtlassianProject from './AtlassianProject'
import {resolveTeam} from 'server/graphql/resolvers'

const AddAtlassianAuthPayload = new GraphQLObjectType({
  name: 'AddAtlassianAuthPayload',
  fields: () => ({
    error: {
      type: StandardMutationError
    },
    atlassianAuth: {
      type: AtlassianAuth,
      description: 'The newly created auth',
      resolve: async ({atlassianAuthId}, _args, {authToken, dataLoader}) => {
        const viewerId = getUserId(authToken)
        const atlassianAuth = await dataLoader.get('atlassianAuths').load(atlassianAuthId)
        if (isSuperUser(authToken) || atlassianAuth.userId === viewerId) {
          return atlassianAuth
        }
        return null
      }
    },
    atlassianProjects: {
      type: new GraphQLList(new GraphQLNonNull(AtlassianProject)),
      description: 'projects that the new auth has joined',
      resolve: ({atlassianProjectIds}, _args, {dataLoader}) => {
        return dataLoader.get('atlassianProjects').loadMany(atlassianProjectIds)
      }
    },
    team: {
      type: Team,
      description: 'The team with the new auth',
      resolve: resolveTeam
    }
  })
})

export default AddAtlassianAuthPayload
