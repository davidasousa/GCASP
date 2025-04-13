import React, { useState } from 'react';
import '../styles/profile-page.css';

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
            <button className="refresh-button" onClick={cancelAddFriends}>
                Exit
            </button>
            <button className="refresh-button" onClick={submitAddFriends}>
                Add Friend
            </button>
          </div>
        </div>
      )}

      <div className="profile-page-header">Profile Page</div>

      <div className="profile-info">
        <label htmlFor="profile-info">User Info</label>
      </div>

      <div className="profile-friends-list">
        <label htmlFor="profile-friends-list">User Friends List</label>
        <div id="friends_list">
          <DisplayFriendsList friendsList={friendsList} />
        </div>
      </div>

      <div className="profile-actions">
        <button className="add-friend-button" onClick={triggerAddFriends}>
          Add Friend
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
