import React, { useState, useEffect } from 'react';
import { secureStorage } from '../utils/secureStorage';
import '../styles/profile-page.css';

const DisplayUserInfoList = ({ userInfo }) => {
  return (
    <div className="profile-friends-list">
        <ul id="profile-userinfo-list">
          <li>GCASP Username: {userInfo.userName}</li>
          <li>GCASP Email: {userInfo.userEmail}</li>
          <li>GCASP Friends: {userInfo.userFriendCount}</li>
          <li>GCASP Total Clips Uploaded: {userInfo.userClipsUploaded}</li>
          <li>GCASP Total Clip Views: {userInfo.userViewCountTotal}</li>
        </ul>
    </div>
  );
};

const DisplayFriendsList = ({ friendsList }) => {
  return (
    <div className="profile-friends-list">
      {friendsList.length > 0 ? (
        <ul id="profile-friends-list">
          {friendsList.map((friend, index) => (
            <li key={index}>{friend}</li>
          ))}
        </ul>
      ) : (
        <p>No Friends Added, Add Some Friends</p>
      )}
    </div>
  );
};

const FriendUsernameInput = ({ friendUsername, setFriendUsername }) => {
  const handleChangeFriendUsername = (event) => {
    setFriendUsername(event.target.value);
  };

  return (
    <div>
      <label htmlFor="textInput">Enter Friend Username:</label>
      <input
        type="text"
        id="textInput"
        value={friendUsername}
        onChange={handleChangeFriendUsername}
        placeholder="Enter Your Friend's GCASP Username"
      />
    </div>
  );
};

const ProfilePage = () => {
  const [friendsList, setFriendsList] = useState([]);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showAddError, setShowAddError] = useState(false);
  const [addErrorMessage, setAddErrorMessage] = useState("");
  const [friendUsername, setFriendUsername] = useState("");
  // User Info Object
  const [userInfo, setUserInfo] = useState ({
    userName: "",
    userEmail: "",
    userFriendCount: 0,
    userClipsUploaded: 0,
    userViewCountTotal: 0
  });

  // Assigning User Infomation
  useEffect(() => {
    const assignUserInfo = async () => {
        // Get Token
        const token = await secureStorage.getToken();

        // Name & Email
        const user = await secureStorage.getUser(); 
        setUserInfo(prev => ({
          ...prev,
          userName: user.username,
          userEmail: user.email
        }));

        // Friends List
        const responseData = await window.electron.getFriendsList(token);
        const usernamesList = responseData.friends.map(friend => friend.username);
        setFriendsList(usernamesList);
      };

    assignUserInfo(); // Call the function
  }, []); // Only run on component mount
  
  const triggerAddFriends = () => {
    setShowAddFriends(true);
  };

  const cancelAddError = () => {
    setAddErrorMessage("");
    setShowAddError(false);
  };

  const cancelAddFriends = () => {
    setShowAddFriends(false);
    setFriendUsername("");
  };

  const submitAddFriends = async () => {
    // Error Handeling
    if (friendUsername === userInfo.userName) { 
      setAddErrorMessage("Error: Cannot Add Oneself")
      setShowAddError(true);
      return; 
    }
    if (friendUsername === "") { 
      setAddErrorMessage("Error: Username Cannot Be Empty")
      setShowAddError(true);
      return; 
    }
    // Trigger Adding Friend On Backend:
    const token = await secureStorage.getToken();
    const response = await window.electron.addFriend(friendUsername, token);

    if(response) {
      setFriendsList([...friendsList, friendUsername]);
    }

    setFriendUsername("");
    setShowAddFriends(false);
    return response;
 
  };

  return (
    <div className="profile-page">
      {/* Add Friend Modal Window */}
      {showAddFriends && (
        <div className="add-friends-modal">
          <div className="modal-content">
            <FriendUsernameInput
              friendUsername={friendUsername}
              setFriendUsername={setFriendUsername}
            />
            <button className="cancel-button" onClick={cancelAddFriends}>
              Cancel
            </button>
            <button className="add-friend-button" onClick={submitAddFriends}>
              Add Friend
            </button>
            {/* Adding Friend Error */}
            <div className = "Add Error Message">
            {showAddError && (
              <div className="add-error-message">
                <div className="error-text">{addErrorMessage}</div>
                <button className="error-button" onClick={cancelAddError}>Ok</button>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      <div className="profile-page-header">GCASP Profile</div>

      <div className="profile-info">
        <label htmlFor="profile-info">User Info</label>
        <div id="userInfo">
          <DisplayUserInfoList userInfo={userInfo} />
        </div>
      </div>

      <div className="profile-friends-list">
        <label htmlFor="profile-friends-list">User Friends List</label>
        <div id="friends_list">
          <DisplayFriendsList friendsList={friendsList} />
        </div>
      </div>

      <div className="friend-actions">
        <button className="add-friend-button" onClick={triggerAddFriends}>
          Add Friend
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
