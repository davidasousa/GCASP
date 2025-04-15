import React, { useState } from 'react';
import '../styles/profile-page.css';

const DisplayUserInfoList = ({ userInfo }) => {
  return (
    <div className="profile-friends-list">
        <ul id="profile-userinfo-list">
          <li>GCASP Username: {userInfo.userName}</li>
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
  const [friendUsername, setFriendUsername] = useState("");
  // User Info Object
  const [userInfo, setUserInfo] = useState ({
    userName: "David",
    userFriendCount: 0,
    userClipsUploaded: 0,
    userViewCountTotal: 0
  });

  const triggerAddFriends = () => {
    setShowAddFriends(true);
  };

  const cancelAddFriends = () => {
    setShowAddFriends(false);
    setFriendUsername("");
  };

  const submitAddFriends = () => {
    if (friendUsername.trim() !== "") {
        // Trigger Adding Friend On Backend:
        
        setFriendsList([...friendsList, friendUsername]);
        setFriendUsername("");
        setShowAddFriends(false);
    }
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
            <button className="add-friend-confirm-button" onClick={submitAddFriends}>
              Add Friend
            </button>
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
